/**
 * LinearClient.js
 * Client for interacting with the Linear API
 */

const { LinearClient: LinearSDK } = require('@linear/sdk');
const logger = require('./logger');

class LinearClient {
  /**
   * Initialize the Linear client
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    this.config = config;
    this.client = null;
    this.isAuthenticated = false;
    
    // Initialize client if API key is provided
    if (config.linear && config.linear.apiKey) {
      this.initialize(config.linear.apiKey);
    }
    
    logger.info('LinearClient initialized');
  }
  
  /**
   * Initialize the Linear client with an API key
   * @param {string} apiKey - Linear API key
   * @returns {boolean} Success status
   */
  initialize(apiKey) {
    try {
      this.client = new LinearSDK({ apiKey });
      this.isAuthenticated = true;
      logger.info('Linear client authenticated');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize Linear client: ${error.message}`);
      this.isAuthenticated = false;
      return false;
    }
  }
  
  /**
   * Check if the client is authenticated
   * @returns {boolean} Authentication status
   */
  isReady() {
    return this.isAuthenticated && this.client !== null;
  }
  
  /**
   * Get teams from Linear
   * @returns {Promise<Array>} Teams
   */
  async getTeams() {
    try {
      if (!this.isReady()) {
        throw new Error('Linear client not authenticated');
      }
      
      const { teams } = await this.client.teams();
      return teams.nodes;
    } catch (error) {
      logger.error(`Failed to get teams: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get projects for a team
   * @param {string} teamId - Team ID
   * @returns {Promise<Array>} Projects
   */
  async getProjects(teamId) {
    try {
      if (!this.isReady()) {
        throw new Error('Linear client not authenticated');
      }
      
      const { projects } = await this.client.projects({
        filter: {
          team: { id: { eq: teamId } }
        }
      });
      
      return projects.nodes;
    } catch (error) {
      logger.error(`Failed to get projects: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Create an issue in Linear
   * @param {Object} issueData - Issue data
   * @returns {Promise<Object>} Created issue
   */
  async createIssue(issueData) {
    try {
      if (!this.isReady()) {
        throw new Error('Linear client not authenticated');
      }
      
      const { title, description, teamId, projectId, assigneeId, priority, labels } = issueData;
      
      const issueCreateInput = {
        title,
        description,
        teamId,
        projectId,
        assigneeId,
        priority: priority || 0
      };
      
      const { issueCreate } = await this.client.issueCreate(issueCreateInput);
      
      // Add labels if provided
      if (labels && labels.length > 0 && issueCreate.issue) {
        for (const labelName of labels) {
          await this.addLabelToIssue(issueCreate.issue.id, labelName);
        }
      }
      
      logger.info(`Issue created: ${issueCreate.issue.id}`);
      
      return issueCreate.issue;
    } catch (error) {
      logger.error(`Failed to create issue: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Add a label to an issue
   * @param {string} issueId - Issue ID
   * @param {string} labelName - Label name
   * @returns {Promise<boolean>} Success status
   */
  async addLabelToIssue(issueId, labelName) {
    try {
      if (!this.isReady()) {
        throw new Error('Linear client not authenticated');
      }
      
      // Find or create the label
      const { labels } = await this.client.labels({
        filter: {
          name: { eq: labelName }
        }
      });
      
      let labelId;
      
      if (labels.nodes.length > 0) {
        labelId = labels.nodes[0].id;
      } else {
        // Create the label
        const { labelCreate } = await this.client.labelCreate({
          name: labelName,
          color: '#' + Math.floor(Math.random() * 16777215).toString(16) // Random color
        });
        
        labelId = labelCreate.label.id;
      }
      
      // Add label to issue
      await this.client.issueLabelCreate({
        issueId,
        labelId
      });
      
      return true;
    } catch (error) {
      logger.error(`Failed to add label to issue: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get issues for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} Issues
   */
  async getProjectIssues(projectId) {
    try {
      if (!this.isReady()) {
        throw new Error('Linear client not authenticated');
      }
      
      const { issues } = await this.client.issues({
        filter: {
          project: { id: { eq: projectId } }
        }
      });
      
      return issues.nodes;
    } catch (error) {
      logger.error(`Failed to get project issues: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Update an issue
   * @param {string} issueId - Issue ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated issue
   */
  async updateIssue(issueId, updateData) {
    try {
      if (!this.isReady()) {
        throw new Error('Linear client not authenticated');
      }
      
      const { issueUpdate } = await this.client.issueUpdate({
        id: issueId,
        ...updateData
      });
      
      logger.info(`Issue updated: ${issueId}`);
      
      return issueUpdate.issue;
    } catch (error) {
      logger.error(`Failed to update issue: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Create a comment on an issue
   * @param {string} issueId - Issue ID
   * @param {string} body - Comment body
   * @returns {Promise<Object>} Created comment
   */
  async createComment(issueId, body) {
    try {
      if (!this.isReady()) {
        throw new Error('Linear client not authenticated');
      }
      
      const { commentCreate } = await this.client.commentCreate({
        issueId,
        body
      });
      
      logger.info(`Comment created on issue: ${issueId}`);
      
      return commentCreate.comment;
    } catch (error) {
      logger.error(`Failed to create comment: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Create a Linear project
   * @param {Object} projectData - Project data
   * @returns {Promise<Object>} Created project
   */
  async createProject(projectData) {
    try {
      if (!this.isReady()) {
        throw new Error('Linear client not authenticated');
      }
      
      const { name, description, teamId, icon, color } = projectData;
      
      const { projectCreate } = await this.client.projectCreate({
        name,
        description,
        teamId,
        icon: icon || '🚀',
        color: color || '#' + Math.floor(Math.random() * 16777215).toString(16) // Random color
      });
      
      logger.info(`Project created: ${projectCreate.project.id}`);
      
      return projectCreate.project;
    } catch (error) {
      logger.error(`Failed to create project: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Link a Linear issue to a GitHub PR
   * @param {string} issueId - Linear issue ID
   * @param {string} url - GitHub PR URL
   * @returns {Promise<boolean>} Success status
   */
  async linkIssueToGitHub(issueId, url) {
    try {
      if (!this.isReady()) {
        throw new Error('Linear client not authenticated');
      }
      
      // Update issue with GitHub URL
      await this.updateIssue(issueId, {
        description: `GitHub PR: ${url}\\n\\n${description || ''}`
      });
      
      // Add comment with link
      await this.createComment(issueId, `Linked to GitHub PR: ${url}`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to link issue to GitHub: ${error.message}`);
      return false;
    }
  }
}

module.exports = LinearClient;