import dotenv from 'dotenv';
import axios, { AxiosInstance } from 'axios';
import enquirer from 'enquirer';
import fs from 'fs/promises';

// Load environment variables
dotenv.config();

// TypeScript Interfaces
interface PipelineVariable {
  key: string;
  value: string;
  protected?: boolean;
  masked?: boolean;
  raw?: boolean;
}

interface TriggerPipelineRequest {
  ref: string;
  token?: string;
  variables?: PipelineVariable[];
}

interface PipelineResponse {
  id: number;
  iid: number;
  project_id: number;
  sha: string;
  ref: string;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
  web_url: string;
}

interface Job {
  id: number;
  name: string;
  ref: string;
  stage: string;
  status: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  web_url: string;
  manual: boolean;
  allow_failure: boolean;
}

interface Project {
  id: string;
  name: string;
}

interface GitLabConfig {
  host: string;
  privateToken: string;
  autoRunManualJobs: boolean;
}

class GitLabPipelineTrigger {
  private config: GitLabConfig;
  private client: AxiosInstance;

  constructor() {
    // Validate environment variables
    const requiredEnvVars = ['GITLAB_HOST', 'GITLAB_PRIVATE_TOKEN'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    this.config = {
      host: process.env.GITLAB_HOST!,
      privateToken: process.env.GITLAB_PRIVATE_TOKEN!,
      autoRunManualJobs: process.env.AUTO_RUN_MANUAL_JOBS === 'true',
    };

    // Initialize axios client
    this.client = axios.create({
      baseURL: `${this.config.host}/api/v4`,
      headers: {
        'Authorization': `Bearer ${this.config.privateToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Load projects from JSON file
  private async loadProjects(): Promise<Project[]> {
    try {
      const data = await fs.readFile('./projects.json', 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('❌ Failed to load projects from projects.json:', error);
      throw error;
    }
  }

  // Interactive project selection
  private async selectProjects(projects: Project[]): Promise<Project[]> {
    try {
      const selectedIds = await enquirer.prompt({
        type: 'multiselect',
        name: 'projects',
        message: '📋 Select one or more projects to trigger pipelines:',
        choices: projects.map(project => ({
          name: project.id,
          message: `${project.name}`,
        })),
      }) as { projects: string[] };
      
      return projects.filter(project => selectedIds.projects.includes(project.id));
    } catch (error) {
      console.error('❌ Project selection cancelled:', error);
      process.exit(0);
      return [];
    }
  }

  // Interactive branch selection for a project
  private async selectBranch(project: Project): Promise<string> {
    try {
      const result = await enquirer.prompt({
        type: 'input',
        name: 'branch',
        message: `🔀 Enter branch name for ${project.name}:`,
        initial: 'main',
        validate: (value: string) => value.trim() ? true : 'Branch name cannot be empty',
      }) as { branch: string };
      
      return result.branch.trim();
    } catch (error) {
      console.error('❌ Branch selection cancelled:', error);
      process.exit(0);
      return 'main';
    }
  }

  // Extract pipeline variables from environment variables
  private getPipelineVariables(): PipelineVariable[] {
    const variables: PipelineVariable[] = [];
    
    // Look for environment variables that start with VARIABLE_ and add them to variables array
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('VARIABLE_') && value !== undefined) {
        const variableKey = key.replace('VARIABLE_', '');
        variables.push({
          key: variableKey,
          value,
        });
      }
    }
    
    return variables;
  }

  // Fetch all jobs for a pipeline
  private async getPipelineJobs(projectId: string, pipelineId: number): Promise<Job[]> {
    try {
      console.log(`📋 Fetching jobs for pipeline ${pipelineId}...`);
      const response = await this.client.get<Job[]>(
        `/projects/${projectId}/pipelines/${pipelineId}/jobs`
      );
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to fetch jobs for pipeline ${pipelineId}:`, error);
      throw error;
    }
  }

  // Run a manual job
  private async runManualJob(projectId: string, jobId: number): Promise<void> {
    try {
      console.log(`▶️  Running manual job ${jobId}...`);
      await this.client.post(
        `/projects/${projectId}/jobs/${jobId}/play`
      );
      console.log(`✅ Manual job ${jobId} started successfully`);
    } catch (error) {
      console.error(`❌ Failed to run manual job ${jobId}:`, error);
      throw error;
    }
  }

  // Run all manual jobs for a pipeline
  private async runAllManualJobs(projectId: string, pipelineId: number): Promise<void> {
    try {
      console.log(`🤖 Starting auto-run of manual jobs for pipeline ${pipelineId}`);
      
      // Add delay to allow GitLab to create jobs after pipeline is triggered
      console.log('⏳ Waiting 5 seconds for GitLab to initialize pipeline jobs...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Retry fetching jobs up to 3 times if no manual jobs are found initially
      let manualJobs: Job[] = [];
      let retryCount = 0;
      const maxRetries = 3;
      
      while (manualJobs.length === 0 && retryCount < maxRetries) {
        retryCount++;
        if (retryCount > 1) {
          console.log(`⏳ Retry ${retryCount-1}/${maxRetries-1}: Waiting 3 seconds before checking again...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        console.log(`📋 Fetching jobs for pipeline ${pipelineId} (attempt ${retryCount}/${maxRetries})...`);
        const jobs = await this.getPipelineJobs(projectId, pipelineId);
        
        // Log all jobs found for debugging
        console.log(`📋 Total jobs found: ${jobs.length}`);
        jobs.forEach(job => {
          console.log(`   - ${job.name} (${job.stage}) - Status: ${job.status}, Manual: ${job.manual}, ID: ${job.id}`);
        });
        
        manualJobs = jobs.filter(job => job.status === 'manual');
        
        if (manualJobs.length > 0) {
          break;
        }
      }
      
      if (manualJobs.length === 0) {
        console.log('📋 No manual jobs found for this pipeline after all attempts');
        return;
      }
      
      console.log(`📋 Found ${manualJobs.length} manual jobs:`);
      manualJobs.forEach(job => {
        console.log(`   - ${job.name} (${job.stage}) - ID: ${job.id}`);
      });
      
      // Run manual jobs sequentially (to respect stage dependencies)
      for (const job of manualJobs) {
        await this.runManualJob(projectId, job.id);
        // Wait a bit between job triggers to avoid API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log(`✅ All manual jobs for pipeline ${pipelineId} have been triggered`);
    } catch (error) {
      console.error(`❌ Failed to run manual jobs:`, error);
      throw error;
    }
  }

  // Trigger GitLab pipeline for a single project
  async triggerPipeline(project: Project, ref: string): Promise<PipelineResponse> {
    try {
      console.log(`\n🚀 Triggering pipeline for project: ${project.name}`);
      console.log(`📋 Project: ${this.config.host}/projects/${project.id}`);
      console.log(`🔀 Branch: ${ref}`);

      const variables = this.getPipelineVariables();
      if (variables.length > 0) {
        console.log('📝 Pipeline Variables:');
        variables.forEach(v => console.log(`   - ${v.key}: ${v.value}`));
      }

      const requestBody: TriggerPipelineRequest = {
        ref,
        variables: variables.length > 0 ? variables : undefined,
      };

      const response = await this.client.post<PipelineResponse>(
        `/projects/${project.id}/pipeline`,
        requestBody
      );

      console.log('✅ Pipeline triggered successfully!');
      console.log(`📌 Pipeline ID: ${response.data.id}`);
      console.log(`🌐 Pipeline URL: ${response.data.web_url}`);
      console.log(`📊 Status: ${response.data.status}`);
      console.log(`🔍 SHA: ${response.data.sha}`);

      // Run manual jobs if enabled
      if (this.config.autoRunManualJobs) {
        console.log('🤖 Auto-run manual jobs is enabled');
        await this.runAllManualJobs(project.id, response.data.id);
      } else {
        console.log('🔄 Auto-run manual jobs is disabled. Set AUTO_RUN_MANUAL_JOBS=true in .env to enable.');
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`❌ Failed to trigger pipeline for ${project.name}:`, error.message);
        if (error.response) {
          console.error('📋 Error Details:', error.response.data);
          console.error('🔢 Status Code:', error.response.status);
        }
      } else {
        console.error(`❌ Unexpected error for ${project.name}:`, error);
      }
      throw error;
    }
  }

  // Interactive flow for project and branch selection
  async interactiveFlow(): Promise<void> {
    try {
      // Step 1: Load and select projects
      const allProjects = await this.loadProjects();
      console.log(`\n📋 Found ${allProjects.length} projects:`);
      const selectedProjects = await this.selectProjects(allProjects);
      
      if (selectedProjects.length === 0) {
        console.log('📋 No projects selected. Exiting.');
        return;
      }
      
      console.log(`\n📋 Selected ${selectedProjects.length} project(s):`);
      selectedProjects.forEach(project => {
        console.log(`   - ${project.name}`);
      });
      
      // Step 2: Select branches and trigger pipelines
      for (const project of selectedProjects) {
        const branch = await this.selectBranch(project);
        await this.triggerPipeline(project, branch);
      }
      
      console.log('\n🎉 All pipelines triggered successfully!');
    } catch (error) {
      console.error('💥 Interactive flow failed:', error);
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  try {
    const trigger = new GitLabPipelineTrigger();
    await trigger.interactiveFlow();
  } catch (error) {
    console.error('💥 Execution failed. Exiting with code 1.');
    process.exit(1);
  }
}

// Run the script
main();
