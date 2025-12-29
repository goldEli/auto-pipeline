import dotenv from 'dotenv';
import axios, { AxiosInstance } from 'axios';

// Load environment variables
dotenv.config();

// TypeScript Interfaces
interface GitLabProject {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  description: string | null;
  default_branch: string | null;
  ssh_url_to_repo: string;
  http_url_to_repo: string;
  web_url: string;
  created_at: string;
  last_activity_at: string;
  archived: boolean;
  visibility: 'private' | 'internal' | 'public';
}

interface GitLabConfig {
  host: string;
  privateToken: string;
}

class GitLabProjectFetcher {
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

  // Fetch all projects with pagination
  async fetchAllProjects(): Promise<GitLabProject[]> {
    try {
      console.log('🚀 Fetching all GitLab projects...');
      console.log(`📋 GitLab Host: ${this.config.host}`);
      
      const allProjects: GitLabProject[] = [];
      let currentPage = 1;
      const perPage = 100; // Maximum allowed by GitLab API
      let totalPages = 1;
      
      while (currentPage <= totalPages) {
        console.log(`📄 Fetching page ${currentPage}/${totalPages}...`);
        
        const response = await this.client.get<GitLabProject[]>(
          '/projects',
          {
            params: {
              per_page: perPage,
              page: currentPage,
              order_by: 'name',
              sort: 'asc',
            },
          }
        );
        
        // Get total pages from Link header or use response data length
        const linkHeader = response.headers['link'];
        if (linkHeader) {
          const totalPagesMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
          if (totalPagesMatch) {
            totalPages = parseInt(totalPagesMatch[1], 10);
          }
        } else if (response.data.length < perPage) {
          // No Link header and less than perPage results, so this is the last page
          totalPages = currentPage;
        }
        
        // Add projects to array
        allProjects.push(...response.data);
        
        console.log(`📥 Added ${response.data.length} projects (Total: ${allProjects.length})`);
        
        // Move to next page
        currentPage++;
        
        // Add small delay to avoid API rate limits
        if (currentPage <= totalPages) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      console.log(`✅ Fetch completed! Total projects: ${allProjects.length}`);
      return allProjects;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('❌ Failed to fetch projects:', error.message);
        if (error.response) {
          console.error('📥 Response Status:', error.response.status);
          console.error('📋 Response Data:', JSON.stringify(error.response.data, null, 2));
        }
      } else {
        console.error('❌ Unexpected error:', error);
      }
      throw error;
    }
  }

  // Output projects in a readable format
  outputProjects(projects: GitLabProject[]): void {
    console.log('\n📋 GitLab Projects:');
    console.log('=' . repeat(60));

    // filter with weex-fronend string by  web_url
    const filtered = projects.filter(project => project.web_url.includes('weex-fronend'));
    
    filtered.forEach((project, index) => {
      console.log(`   id: ${project.id}`);
      console.log(`   name: ${project.name}`);
      console.log('');
    });

    const outputProjects = filtered.map(project => ({
      id: project.id,
      name: project.name,
    }));
    
    console.log('\n' + '=' . repeat(60));
    console.log(outputProjects);
  }
}

// Main execution
async function main() {
  try {
    const fetcher = new GitLabProjectFetcher();
    const projects = await fetcher.fetchAllProjects();
    fetcher.outputProjects(projects);
  } catch (error) {
    console.error('💥 Execution failed. Exiting with code 1.');
    process.exit(1);
  }
}

// Run the script
main();
