/**
 * MultiProjectManager.js
 * Manages multiple projects with tabbed interface
 */

const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const logger = require('../utils/logger');

class MultiProjectManager {
  /**
   * Initialize the MultiProjectManager
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    this.config = config;
    this.projectsDir = path.join(process.cwd(), 'projects');
    this.configDir = path.join(process.cwd(), 'config');
    
    // Ensure directories exist
    fs.ensureDirSync(this.projectsDir);
    fs.ensureDirSync(this.configDir);
    
    // Initialize project tabs
    this.projectTabs = [];
    
    // Load project tabs
    this.loadProjectTabs();
    
    logger.info('MultiProjectManager initialized');
  }
  
  /**
   * Load project tabs from configuration
   */
  loadProjectTabs() {
    try {
      const tabsPath = path.join(this.configDir, 'project-tabs.json');
      
      if (fs.existsSync(tabsPath)) {
        this.projectTabs = fs.readJsonSync(tabsPath);
        logger.info(`Loaded ${this.projectTabs.length} project tabs`);
      } else {
        this.projectTabs = [];
        this.saveProjectTabs();
        logger.info('Created empty project tabs file');
      }
    } catch (error) {
      logger.error(`Failed to load project tabs: ${error.message}`);
      this.projectTabs = [];
    }
  }
  
  /**
   * Save project tabs to configuration
   */
  saveProjectTabs() {
    try {
      const tabsPath = path.join(this.configDir, 'project-tabs.json');
      fs.writeJsonSync(tabsPath, this.projectTabs, { spaces: 2 });
    } catch (error) {
      logger.error(`Failed to save project tabs: ${error.message}`);
    }
  }
  
  /**
   * Add a project tab
   * @param {Object} projectTab - Project tab data
   * @returns {Promise<Object>} Added project tab
   */
  async addProjectTab(projectTab) {
    try {
      if (!projectTab.projectName) {
        throw new Error('Project name is required');
      }
      
      // Check if project already exists
      const existingTab = this.projectTabs.find(tab => tab.projectName === projectTab.projectName);
      
      if (existingTab) {
        return existingTab;
      }
      
      // Create project directory if it doesn't exist
      const projectPath = path.join(this.projectsDir, projectTab.projectName);
      
      if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
      }
      
      // Clone repository if provided
      if (projectTab.repoUrl) {
        if (fs.existsSync(path.join(projectPath, '.git'))) {
          // Pull latest changes
          await execAsync('git pull', { cwd: projectPath });
        } else {
          // Clone repository
          await execAsync(`git clone ${projectTab.repoUrl} "${projectPath}"`);
        }
      }
      
      // Create project tab
      const newTab = {
        id: projectTab.id || uuidv4(),
        projectName: projectTab.projectName,
        repoUrl: projectTab.repoUrl || null,
        isLocal: projectTab.isLocal !== undefined ? projectTab.isLocal : !projectTab.repoUrl,
        isInitialized: projectTab.isInitialized || false,
        status: projectTab.status || 'active',
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      this.projectTabs.push(newTab);
      this.saveProjectTabs();
      
      logger.info(`Project tab added: ${newTab.projectName} (${newTab.id})`);
      
      return newTab;
    } catch (error) {
      logger.error(`Failed to add project tab: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Remove a project tab
   * @param {string} tabId - Tab ID
   * @returns {boolean} Success status
   */
  removeProjectTab(tabId) {
    const index = this.projectTabs.findIndex(tab => tab.id === tabId);
    
    if (index === -1) {
      return false;
    }
    
    const removedTab = this.projectTabs[index];
    this.projectTabs.splice(index, 1);
    this.saveProjectTabs();
    
    logger.info(`Project tab removed: ${removedTab.projectName} (${tabId})`);
    
    return true;
  }
  
  /**
   * Get all project tabs
   * @returns {Array} Project tabs
   */
  getAllProjectTabs() {
    return this.projectTabs;
  }
  
  /**
   * Get a project by name
   * @param {string} projectName - Project name
   * @returns {Object|null} Project tab or null if not found
   */
  getProjectByName(projectName) {
    return this.projectTabs.find(tab => tab.projectName === projectName) || null;
  }
  
  /**
   * Get a project by ID
   * @param {string} tabId - Tab ID
   * @returns {Object|null} Project tab or null if not found
   */
  getProject(tabId) {
    return this.projectTabs.find(tab => tab.id === tabId) || null;
  }
  
  /**
   * Initialize a project
   * @param {string} tabId - Tab ID
   * @returns {Promise<boolean>} Success status
   */
  async initializeProject(tabId) {
    try {
      const tab = this.getProject(tabId);
      
      if (!tab) {
        throw new Error(`Project tab not found: ${tabId}`);
      }
      
      const projectPath = path.join(this.projectsDir, tab.projectName);
      
      // Check if project directory exists
      if (!fs.existsSync(projectPath)) {
        throw new Error(`Project directory not found: ${projectPath}`);
      }
      
      // Copy template files to project
      const templateFiles = [
        'GenerateSTRUCTURE\'current\'.promptp',
        'generateSTRUCTURE\'suggested\'.prompt',
        'GenerateSTEP.prompt',
        'GenerateREADMERules.prompt'
      ];
      
      const templatesDir = path.join(process.cwd(), 'templates');
      
      for (const file of templateFiles) {
        const sourcePath = path.join(templatesDir, file);
        const destPath = path.join(projectPath, file);
        
        // Check if template exists
        if (fs.existsSync(sourcePath)) {
          fs.copySync(sourcePath, destPath);
          logger.info(`Copied template: ${file} to ${tab.projectName}`);
        } else {
          // Create default template
          await this.createDefaultTemplate(file, destPath);
          logger.info(`Created default template: ${file} in ${tab.projectName}`);
        }
      }
      
      // Update project tab
      const index = this.projectTabs.findIndex(t => t.id === tabId);
      this.projectTabs[index].isInitialized = true;
      this.projectTabs[index].updatedAt = new Date().toISOString();
      this.saveProjectTabs();
      
      logger.info(`Project initialized: ${tab.projectName} (${tabId})`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to initialize project: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Create a default template file
   * @param {string} templateName - Template name
   * @param {string} destPath - Destination path
   * @returns {Promise<void>}
   */
  async createDefaultTemplate(templateName, destPath) {
    let content = '';
    
    switch (templateName) {
      case 'GenerateSTRUCTURE\'current\'.promptp':
        content = 'Analyze the current project structure and provide a detailed overview of the codebase organization, key components, and architecture.';
        break;
      case 'generateSTRUCTURE\'suggested\'.prompt':
        content = 'Based on the current project structure, suggest improvements and additional features that would enhance the application.';
        break;
      case 'GenerateSTEP.prompt':
        content = 'Create a step-by-step implementation plan for the project, breaking down the development into manageable phases with concurrent components.';
        break;
      case 'GenerateREADMERules.prompt':
        content = 'Generate a comprehensive README.md file for the project, including installation instructions, usage examples, and contribution guidelines.';
        break;
      default:
        content = `Default template content for ${templateName}`;
    }
    
    await fs.writeFile(destPath, content);
  }
  
  /**
   * Check if a project is initialized
   * @param {string} tabId - Tab ID
   * @returns {Promise<Object>} Initialization status
   */
  async checkProjectInitialization(tabId) {
    try {
      const tab = this.getProject(tabId);
      
      if (!tab) {
        throw new Error(`Project tab not found: ${tabId}`);
      }
      
      const projectPath = path.join(this.projectsDir, tab.projectName);
      
      // Check if project directory exists
      if (!fs.existsSync(projectPath)) {
        return {
          isInitialized: false,
          missingFiles: ['project directory']
        };
      }
      
      // Check for required files
      const requiredFiles = [
        'GenerateSTRUCTURE\'current\'.promptp',
        'generateSTRUCTURE\'suggested\'.prompt',
        'GenerateSTEP.prompt',
        'GenerateREADMERules.prompt'
      ];
      
      const missingFiles = [];
      
      for (const file of requiredFiles) {
        const filePath = path.join(projectPath, file);
        
        if (!fs.existsSync(filePath)) {
          missingFiles.push(file);
        }
      }
      
      const isInitialized = missingFiles.length === 0;
      
      // Update project tab if needed
      if (isInitialized !== tab.isInitialized) {
        const index = this.projectTabs.findIndex(t => t.id === tabId);
        this.projectTabs[index].isInitialized = isInitialized;
        this.projectTabs[index].updatedAt = new Date().toISOString();
        this.saveProjectTabs();
      }
      
      return {
        isInitialized,
        missingFiles
      };
    } catch (error) {
      logger.error(`Failed to check project initialization: ${error.message}`);
      return {
        isInitialized: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get project status
   * @param {string} tabId - Tab ID
   * @returns {Promise<Object>} Project status
   */
  async getProjectStatus(tabId) {
    try {
      const tab = this.getProject(tabId);
      
      if (!tab) {
        throw new Error(`Project tab not found: ${tabId}`);
      }
      
      const projectPath = path.join(this.projectsDir, tab.projectName);
      
      // Check if project directory exists
      if (!fs.existsSync(projectPath)) {
        return {
          status: 'missing',
          error: 'Project directory not found'
        };
      }
      
      // Check initialization status
      const initStatus = await this.checkProjectInitialization(tabId);
      
      // Get project configuration
      const configPath = path.join(projectPath, 'project.json');
      let config = {};
      
      if (fs.existsSync(configPath)) {
        config = fs.readJsonSync(configPath);
      }
      
      // Check for STEPS.md
      const stepsPath = path.join(projectPath, 'STEPS.md');
      const hasSteps = fs.existsSync(stepsPath);
      
      // Check for STRUCTURE.md
      const structurePath = path.join(projectPath, 'STRUCTURE.md');
      const hasStructure = fs.existsSync(structurePath);
      
      // Check git status
      let gitStatus = null;
      
      try {
        if (fs.existsSync(path.join(projectPath, '.git'))) {
          const { stdout } = await execAsync('git status --porcelain', { cwd: projectPath });
          gitStatus = {
            hasChanges: stdout.trim().length > 0,
            changes: stdout.trim()
          };
        }
      } catch (error) {
        logger.warn(`Failed to get git status: ${error.message}`);
      }
      
      return {
        id: tab.id,
        name: tab.projectName,
        repoUrl: tab.repoUrl,
        isLocal: tab.isLocal,
        isInitialized: initStatus.isInitialized,
        status: tab.status,
        addedAt: tab.addedAt,
        updatedAt: tab.updatedAt,
        config,
        hasSteps,
        hasStructure,
        gitStatus
      };
    } catch (error) {
      logger.error(`Failed to get project status: ${error.message}`);
      return {
        status: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Get status for all projects
   * @returns {Promise<Array>} Project statuses
   */
  async getProjectsStatus() {
    const statuses = [];
    
    for (const tab of this.projectTabs) {
      try {
        const status = await this.getProjectStatus(tab.id);
        statuses.push(status);
      } catch (error) {
        logger.error(`Failed to get status for project ${tab.projectName}: ${error.message}`);
        statuses.push({
          id: tab.id,
          name: tab.projectName,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return statuses;
  }
  
  /**
   * Create a new project
   * @param {Object} projectData - Project data
   * @returns {Promise<Object>} Creation result
   */
  async createProject(projectData) {
    try {
      if (!projectData.name) {
        throw new Error('Project name is required');
      }
      
      // Check if project already exists
      const existingProject = this.getProjectByName(projectData.name);
      
      if (existingProject) {
        throw new Error(`Project ${projectData.name} already exists`);
      }
      
      // Create project directory
      const projectPath = path.join(this.projectsDir, projectData.name);
      fs.ensureDirSync(projectPath);
      
      // Create project configuration
      const configPath = path.join(projectPath, 'project.json');
      const config = {
        name: projectData.name,
        description: projectData.description || '',
        repository: projectData.repoUrl || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      fs.writeJsonSync(configPath, config, { spaces: 2 });
      
      // Create README.md
      const readmePath = path.join(projectPath, 'README.md');
      const readmeContent = `# ${projectData.name}\\n\\n${projectData.description || ''}\\n`;
      fs.writeFileSync(readmePath, readmeContent);
      
      // Add project tab
      const tab = await this.addProjectTab({
        projectName: projectData.name,
        repoUrl: projectData.repoUrl,
        isLocal: !projectData.repoUrl
      });
      
      // Initialize project if requested
      if (projectData.initialize) {
        await this.initializeProject(tab.id);
      }
      
      logger.info(`Project created: ${projectData.name}`);
      
      return {
        success: true,
        project: tab
      };
    } catch (error) {
      logger.error(`Failed to create project: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = MultiProjectManager;