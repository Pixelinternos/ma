/**
 * GitHubEnhanced.js
 * Enhanced GitHub integration with webhook processing and PR analysis
 */

const { Octokit } = require('@octokit/rest');
const { createNodeMiddleware } = require('@octokit/webhooks');
const EventEmitter = require('events');
const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

class GitHubEnhanced extends EventEmitter {
  /**
   * Initialize the GitHubEnhanced service
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    super();
    this.config = config;
    this.octokit = null;
    this.webhooks = null;
    
    // Initialize queues
    this.prAnalysisQueue = [];
    this.mergeQueue = [];
    
    // Load saved queues
    this.loadQueues();
    
    logger.info('GitHubEnhanced initialized');
  }
  
  /**
   * Authenticate with GitHub
   * @returns {Promise<boolean>} Success status
   */
  async authenticate() {
    try {
      const token = this.config.github?.token || process.env.GITHUB_TOKEN;
      
      if (!token) {
        throw new Error('GitHub token not provided');
      }
      
      this.octokit = new Octokit({
        auth: token
      });
      
      // Test authentication
      const { data } = await this.octokit.users.getAuthenticated();
      logger.info(`Authenticated as ${data.login}`);
      
      return true;
    } catch (error) {
      logger.error(`GitHub authentication failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Load saved queues from disk
   */
  loadQueues() {
    try {
      const dataDir = path.join(process.cwd(), 'data', 'github');
      fs.ensureDirSync(dataDir);
      
      const prAnalysisPath = path.join(dataDir, 'pr-analysis-queue.json');
      const mergePath = path.join(dataDir, 'merge-queue.json');
      
      if (fs.existsSync(prAnalysisPath)) {
        this.prAnalysisQueue = fs.readJsonSync(prAnalysisPath);
      }
      
      if (fs.existsSync(mergePath)) {
        this.mergeQueue = fs.readJsonSync(mergePath);
      }
      
      logger.info(`Loaded ${this.prAnalysisQueue.length} PR analysis items and ${this.mergeQueue.length} merge items`);
    } catch (error) {
      logger.error(`Failed to load queues: ${error.message}`);
    }
  }
  
  /**
   * Save queues to disk
   */
  saveQueues() {
    try {
      const dataDir = path.join(process.cwd(), 'data', 'github');
      fs.ensureDirSync(dataDir);
      
      const prAnalysisPath = path.join(dataDir, 'pr-analysis-queue.json');
      const mergePath = path.join(dataDir, 'merge-queue.json');
      
      fs.writeJsonSync(prAnalysisPath, this.prAnalysisQueue, { spaces: 2 });
      fs.writeJsonSync(mergePath, this.mergeQueue, { spaces: 2 });
    } catch (error) {
      logger.error(`Failed to save queues: ${error.message}`);
    }
  }
  
  /**
   * Setup webhook server
   * @param {Object} options - Webhook options
   * @returns {Object} Webhook middleware
   */
  setupWebhooks(options = {}) {
    try {
      const { Webhooks } = require('@octokit/webhooks');
      
      const secret = options.secret || this.config.github?.webhookSecret;
      
      if (!secret) {
        throw new Error('Webhook secret not provided');
      }
      
      this.webhooks = new Webhooks({
        secret
      });
      
      // Register webhook handlers
      this.webhooks.on('pull_request.opened', ({ payload }) => {
        this.handlePullRequestOpened(payload);
      });
      
      this.webhooks.on('pull_request.synchronize', ({ payload }) => {
        this.handlePullRequestUpdated(payload);
      });
      
      this.webhooks.on('create', ({ payload }) => {
        if (payload.ref_type === 'branch') {
          this.handleBranchCreated(payload);
        }
      });
      
      logger.info('GitHub webhooks configured');
      
      return createNodeMiddleware(this.webhooks, { path: options.path || '/api/webhooks/github' });
    } catch (error) {
      logger.error(`Failed to setup webhooks: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Handle pull request opened webhook
   * @param {Object} payload - Webhook payload
   */
  handlePullRequestOpened(payload) {
    try {
      const { repository, pull_request } = payload;
      
      logger.info(`PR #${pull_request.number} opened in ${repository.full_name}`);
      
      // Emit event
      this.emit('prCreated', {
        repoName: repository.full_name,
        prNumber: pull_request.number,
        title: pull_request.title,
        body: pull_request.body,
        branch: pull_request.head.ref
      });
      
      // Add to analysis queue
      this.addPrToAnalysisQueue({
        owner: repository.owner.login,
        repo: repository.name,
        pull_number: pull_request.number
      });
    } catch (error) {
      logger.error(`Error handling PR opened: ${error.message}`);
    }
  }
  
  /**
   * Handle pull request updated webhook
   * @param {Object} payload - Webhook payload
   */
  handlePullRequestUpdated(payload) {
    try {
      const { repository, pull_request } = payload;
      
      logger.info(`PR #${pull_request.number} updated in ${repository.full_name}`);
      
      // Emit event
      this.emit('prUpdated', {
        repoName: repository.full_name,
        prNumber: pull_request.number,
        title: pull_request.title,
        body: pull_request.body,
        branch: pull_request.head.ref
      });
      
      // Add to analysis queue
      this.addPrToAnalysisQueue({
        owner: repository.owner.login,
        repo: repository.name,
        pull_number: pull_request.number
      });
    } catch (error) {
      logger.error(`Error handling PR updated: ${error.message}`);
    }
  }
  
  /**
   * Handle branch created webhook
   * @param {Object} payload - Webhook payload
   */
  handleBranchCreated(payload) {
    try {
      const { repository, ref } = payload;
      
      logger.info(`Branch ${ref} created in ${repository.full_name}`);
      
      // Emit event
      this.emit('branchCreated', {
        repoName: repository.full_name,
        branchName: ref
      });
    } catch (error) {
      logger.error(`Error handling branch created: ${error.message}`);
    }
  }
  
  /**
   * Add a PR to the analysis queue
   * @param {Object} pr - PR data
   * @returns {boolean} Success status
   */
  addPrToAnalysisQueue(pr) {
    try {
      // Check if PR is already in queue
      const existingIndex = this.prAnalysisQueue.findIndex(item => 
        item.owner === pr.owner && 
        item.repo === pr.repo && 
        item.pull_number === pr.pull_number
      );
      
      if (existingIndex !== -1) {
        // Update existing item
        this.prAnalysisQueue[existingIndex] = {
          ...this.prAnalysisQueue[existingIndex],
          ...pr,
          updatedAt: new Date().toISOString()
        };
      } else {
        // Add new item
        this.prAnalysisQueue.push({
          ...pr,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      this.saveQueues();
      
      logger.info(`PR #${pr.pull_number} added to analysis queue`);
      return true;
    } catch (error) {
      logger.error(`Failed to add PR to analysis queue: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Process the PR analysis queue
   * @returns {Promise<boolean>} Success status
   */
  async processAnalysisQueue() {
    try {
      if (!this.octokit) {
        throw new Error('GitHub client not authenticated');
      }
      
      if (this.prAnalysisQueue.length === 0) {
        return true;
      }
      
      logger.info(`Processing ${this.prAnalysisQueue.length} PRs in analysis queue`);
      
      // Process one PR at a time
      const pr = this.prAnalysisQueue[0];
      
      try {
        // Update PR status
        pr.status = 'processing';
        pr.processingStartedAt = new Date().toISOString();
        this.saveQueues();
        
        // Get PR details
        const prDetails = await this.getPRDetails(
          `${pr.owner}/${pr.repo}`, 
          pr.pull_number
        );
        
        if (!prDetails) {
          throw new Error(`Failed to get PR details for #${pr.pull_number}`);
        }
        
        // Analyze PR
        const analysis = await this.analyzePR(prDetails);
        
        // Update PR with analysis results
        pr.analysis = analysis;
        pr.status = 'completed';
        pr.completedAt = new Date().toISOString();
        
        // Check if PR should be auto-merged
        if (pr.autoMerge || analysis.shouldAutoMerge) {
          this.addPrToMergeQueue({
            owner: pr.owner,
            repo: pr.repo,
            pull_number: pr.pull_number,
            merge_method: 'merge'
          });
        }
        
        // Remove from queue
        this.prAnalysisQueue.shift();
        this.saveQueues();
        
        logger.info(`PR #${pr.pull_number} analysis completed`);
      } catch (error) {
        // Update PR status
        pr.status = 'failed';
        pr.error = error.message;
        pr.failedAt = new Date().toISOString();
        this.saveQueues();
        
        logger.error(`Failed to analyze PR #${pr.pull_number}: ${error.message}`);
        
        // Remove from queue to avoid blocking
        this.prAnalysisQueue.shift();
        this.saveQueues();
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to process PR analysis queue: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Analyze a PR
   * @param {Object} pr - PR details
   * @returns {Promise<Object>} Analysis results
   */
  async analyzePR(pr) {
    try {
      // This is a simplified implementation
      // In a real implementation, you would:
      // 1. Analyze the PR changes
      // 2. Check against requirements
      // 3. Validate code quality
      // 4. Check for conflicts
      
      const analysis = {
        title: pr.title,
        body: pr.body,
        changedFiles: pr.changed_files,
        additions: pr.additions,
        deletions: pr.deletions,
        isValid: true,
        shouldAutoMerge: false,
        issues: [],
        completedAt: new Date().toISOString()
      };
      
      // Check if PR title contains auto-merge indicator
      if (pr.title.toLowerCase().includes('auto-merge') || 
          pr.body.toLowerCase().includes('auto-merge')) {
        analysis.shouldAutoMerge = true;
      }
      
      // Check if PR is too large
      if (pr.changed_files > 100 || pr.additions + pr.deletions > 1000) {
        analysis.isValid = false;
        analysis.issues.push('PR is too large');
      }
      
      return analysis;
    } catch (error) {
      logger.error(`Failed to analyze PR: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Add a PR to the merge queue
   * @param {Object} pr - PR data
   * @returns {boolean} Success status
   */
  addPrToMergeQueue(pr) {
    try {
      // Check if PR is already in queue
      const existingIndex = this.mergeQueue.findIndex(item => 
        item.owner === pr.owner && 
        item.repo === pr.repo && 
        item.pull_number === pr.pull_number
      );
      
      if (existingIndex !== -1) {
        // Update existing item
        this.mergeQueue[existingIndex] = {
          ...this.mergeQueue[existingIndex],
          ...pr,
          updatedAt: new Date().toISOString()
        };
      } else {
        // Add new item
        this.mergeQueue.push({
          ...pr,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      this.saveQueues();
      
      logger.info(`PR #${pr.pull_number} added to merge queue`);
      return true;
    } catch (error) {
      logger.error(`Failed to add PR to merge queue: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Process the merge queue
   * @returns {Promise<boolean>} Success status
   */
  async processMergeQueue() {
    try {
      if (!this.octokit) {
        throw new Error('GitHub client not authenticated');
      }
      
      if (this.mergeQueue.length === 0) {
        return true;
      }
      
      logger.info(`Processing ${this.mergeQueue.length} PRs in merge queue`);
      
      // Process one PR at a time
      const pr = this.mergeQueue[0];
      
      try {
        // Update PR status
        pr.status = 'processing';
        pr.processingStartedAt = new Date().toISOString();
        this.saveQueues();
        
        // Merge PR
        await this.mergePR(pr);
        
        // Update PR status
        pr.status = 'completed';
        pr.completedAt = new Date().toISOString();
        
        // Remove from queue
        this.mergeQueue.shift();
        this.saveQueues();
        
        logger.info(`PR #${pr.pull_number} merged successfully`);
      } catch (error) {
        // Update PR status
        pr.status = 'failed';
        pr.error = error.message;
        pr.failedAt = new Date().toISOString();
        this.saveQueues();
        
        logger.error(`Failed to merge PR #${pr.pull_number}: ${error.message}`);
        
        // Remove from queue to avoid blocking
        this.mergeQueue.shift();
        this.saveQueues();
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to process merge queue: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Merge a PR
   * @param {Object} pr - PR data
   * @returns {Promise<Object>} Merge result
   */
  async mergePR(pr) {
    try {
      if (!this.octokit) {
        throw new Error('GitHub client not authenticated');
      }
      
      const { data } = await this.octokit.pulls.merge({
        owner: pr.owner,
        repo: pr.repo,
        pull_number: pr.pull_number,
        merge_method: pr.merge_method || 'merge'
      });
      
      return data;
    } catch (error) {
      logger.error(`Failed to merge PR: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get PR details
   * @param {string} repoName - Repository name (owner/repo)
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} PR details
   */
  async getPRDetails(repoName, prNumber) {
    try {
      if (!this.octokit) {
        throw new Error('GitHub client not authenticated');
      }
      
      const [owner, repo] = repoName.split('/');
      
      const { data } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });
      
      return data;
    } catch (error) {
      logger.error(`Failed to get PR details: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Get open PRs for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} Open PRs
   */
  async getOpenPRs(owner, repo) {
    try {
      if (!this.octokit) {
        throw new Error('GitHub client not authenticated');
      }
      
      const { data } = await this.octokit.pulls.list({
        owner,
        repo,
        state: 'open'
      });
      
      return data;
    } catch (error) {
      logger.error(`Failed to get open PRs: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get branches for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} Branches
   */
  async getBranches(owner, repo) {
    try {
      if (!this.octokit) {
        throw new Error('GitHub client not authenticated');
      }
      
      const { data } = await this.octokit.repos.listBranches({
        owner,
        repo
      });
      
      return data;
    } catch (error) {
      logger.error(`Failed to get branches: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get file content from a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @param {string} ref - Git reference (branch, tag, commit)
   * @returns {Promise<string>} File content
   */
  async getFileContent(owner, repo, path, ref = 'main') {
    try {
      if (!this.octokit) {
        throw new Error('GitHub client not authenticated');
      }
      
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref
      });
      
      // Decode content from base64
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      
      return content;
    } catch (error) {
      logger.error(`Failed to get file content: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Create a webhook for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} url - Webhook URL
   * @param {string} secret - Webhook secret
   * @param {Array<string>} events - Events to subscribe to
   * @returns {Promise<Object>} Created webhook
   */
  async createWebhook(owner, repo, url, secret, events = ['pull_request', 'create']) {
    try {
      if (!this.octokit) {
        throw new Error('GitHub client not authenticated');
      }
      
      const { data } = await this.octokit.repos.createWebhook({
        owner,
        repo,
        config: {
          url,
          content_type: 'json',
          secret
        },
        events
      });
      
      logger.info(`Webhook created for ${owner}/${repo}`);
      
      return data;
    } catch (error) {
      logger.error(`Failed to create webhook: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Create a comment on a PR
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - PR number
   * @param {string} body - Comment body
   * @returns {Promise<Object>} Created comment
   */
  async createPRComment(owner, repo, prNumber, body) {
    try {
      if (!this.octokit) {
        throw new Error('GitHub client not authenticated');
      }
      
      const { data } = await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body
      });
      
      logger.info(`Comment created on PR #${prNumber}`);
      
      return data;
    } catch (error) {
      logger.error(`Failed to create PR comment: ${error.message}`);
      throw error;
    }
  }
}

module.exports = GitHubEnhanced;