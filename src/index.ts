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

interface GitLabConfig {
  host: string;
  projectId: string;
  privateToken: string;
  ref: string;
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
