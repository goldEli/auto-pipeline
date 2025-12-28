import dotenv from 'dotenv';
import axios, { AxiosInstance } from 'axios';

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

interface GitLabConfig {
  host: string;
  projectId: string;
  privateToken: string;
  ref: string;
  autoRunManualJobs: boolean;
}

class GitLabPipelineTrigger {
  private config: GitLabConfig;
  private client: AxiosInstance;

  constructor() {
    // Validate environment variables
    const requiredEnvVars = ['GITLAB_HOST', 'GITLAB_PROJECT_ID', 'GITLAB_PRIVATE_TOKEN', 'REF_NAME'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    this.config = {
      host: process.env.GITLAB_HOST!,
      projectId: process.env.GITLAB_PROJECT_ID!,
      privateToken: process.env.GITLAB_PRIVATE_TOKEN!,
      ref: process.env.REF_NAME || process.env.BRANCH || 'main',
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
  private async getPipelineJobs(pipelineId: number): Promise<Job[]> {
    try {
      console.log(`📋 Fetching jobs for pipeline ${pipelineId}...`);
      const response = await this.client.get<Job[]>(
        `/projects/${this.config.projectId}/pipelines/${pipelineId}/jobs`
      );
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to fetch jobs for pipeline ${pipelineId}:`, error);
      throw error;
    }
  }

  // Run a manual job
  private async runManualJob(jobId: number): Promise<void> {
    try {
      console.log(`▶️  Running manual job ${jobId}...`);
      await this.client.post(
        `/projects/${this.config.projectId}/jobs/${jobId}/play`
      );
      console.log(`✅ Manual job ${jobId} started successfully`);
    } catch (error) {
      console.error(`❌ Failed to run manual job ${jobId}:`, error);
      throw error;
    }
  }

  // Run all manual jobs for a pipeline
  private async runAllManualJobs(pipelineId: number): Promise<void> {
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
        const jobs = await this.getPipelineJobs(pipelineId);
        
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
        await this.runManualJob(job.id);
        // Wait a bit between job triggers to avoid API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log(`✅ All manual jobs for pipeline ${pipelineId} have been triggered`);
    } catch (error) {
      console.error(`❌ Failed to run manual jobs:`, error);
      throw error;
    }
  }

  // Trigger GitLab pipeline
  async triggerPipeline(): Promise<PipelineResponse> {
    try {
      console.log('🚀 Triggering GitLab pipeline...');
      console.log(`📋 Project: ${this.config.host}/projects/${this.config.projectId}`);
      console.log(`🔀 Branch: ${this.config.ref}`);

      const variables = this.getPipelineVariables();
      if (variables.length > 0) {
        console.log('📝 Pipeline Variables:');
        variables.forEach(v => console.log(`   - ${v.key}: ${v.value}`));
      }

      const requestBody: TriggerPipelineRequest = {
        ref: this.config.ref,
        variables: variables.length > 0 ? variables : undefined,
      };

      const response = await this.client.post<PipelineResponse>(
        `/projects/${this.config.projectId}/pipeline`,
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
        await this.runAllManualJobs(response.data.id);
      } else {
        console.log('🔄 Auto-run manual jobs is disabled. Set AUTO_RUN_MANUAL_JOBS=true in .env to enable.');
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('❌ Failed to trigger pipeline:', error.message);
        if (error.response) {
          console.error('📋 Error Details:', error.response.data);
          console.error('🔢 Status Code:', error.response.status);
        }
      } else {
        console.error('❌ Unexpected error:', error);
      }
      throw error;
    }
  }
}

// Main execution
async function main() {
  try {
    const trigger = new GitLabPipelineTrigger();
    await trigger.triggerPipeline();
  } catch (error) {
    console.error('💥 Execution failed. Exiting with code 1.');
    process.exit(1);
  }
}

// Run the script
main();
