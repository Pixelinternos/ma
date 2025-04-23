/**
 * WorkflowManager.js
 * Manages development workflows and phase execution
 */

const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const logger = require('../utils/logger');

class WorkflowManager extends EventEmitter {
  /**
   * Initialize the WorkflowManager
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    super();
    this.config = config;
    this.workflowsDir = path.join(process.cwd(), 'data', 'workflows');
    
    // Ensure workflows directory exists
    fs.ensureDirSync(this.workflowsDir);
    
    // Initialize workflows and templates
    this.workflows = {};
    this.templates = {};
    this.executions = {};
    
    // Load workflows and templates
    this.loadWorkflows();
    this.loadTemplates();
    
    logger.info('WorkflowManager initialized');
  }
  
  /**
   * Load workflows from disk
   */
  loadWorkflows() {
    try {
      const workflowsPath = path.join(this.workflowsDir, 'workflows.json');
      
      if (fs.existsSync(workflowsPath)) {
        this.workflows = fs.readJsonSync(workflowsPath);
        logger.info(`Loaded ${Object.keys(this.workflows).length} workflows`);
      } else {
        this.workflows = {};
        this.saveWorkflows();
        logger.info('Created empty workflows file');
      }
    } catch (error) {
      logger.error(`Failed to load workflows: ${error.message}`);
      this.workflows = {};
    }
  }
  
  /**
   * Save workflows to disk
   */
  saveWorkflows() {
    try {
      const workflowsPath = path.join(this.workflowsDir, 'workflows.json');
      fs.writeJsonSync(workflowsPath, this.workflows, { spaces: 2 });
    } catch (error) {
      logger.error(`Failed to save workflows: ${error.message}`);
    }
  }
  
  /**
   * Load workflow templates from disk
   */
  loadTemplates() {
    try {
      const templatesPath = path.join(this.workflowsDir, 'templates.json');
      
      if (fs.existsSync(templatesPath)) {
        this.templates = fs.readJsonSync(templatesPath);
        logger.info(`Loaded ${Object.keys(this.templates).length} workflow templates`);
      } else {
        this.templates = {};
        this.saveTemplates();
        logger.info('Created empty workflow templates file');
      }
    } catch (error) {
      logger.error(`Failed to load workflow templates: ${error.message}`);
      this.templates = {};
    }
  }
  
  /**
   * Save workflow templates to disk
   */
  saveTemplates() {
    try {
      const templatesPath = path.join(this.workflowsDir, 'templates.json');
      fs.writeJsonSync(templatesPath, this.templates, { spaces: 2 });
    } catch (error) {
      logger.error(`Failed to save workflow templates: ${error.message}`);
    }
  }
  
  /**
   * Create a new workflow
   * @param {Object} workflow - Workflow data
   * @returns {Object} Created workflow
   */
  createWorkflow(workflow) {
    if (!workflow.name) {
      throw new Error('Workflow name is required');
    }
    
    const workflowId = workflow.id || uuidv4();
    
    const newWorkflow = {
      id: workflowId,
      name: workflow.name,
      description: workflow.description || '',
      projectId: workflow.projectId || null,
      phases: workflow.phases || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...workflow
    };
    
    this.workflows[workflowId] = newWorkflow;
    this.saveWorkflows();
    
    logger.info(`Workflow created: ${newWorkflow.name} (${workflowId})`);
    
    return newWorkflow;
  }
  
  /**
   * Get a workflow by ID
   * @param {string} id - Workflow ID
   * @returns {Object|null} Workflow object or null if not found
   */
  getWorkflow(id) {
    return this.workflows[id] || null;
  }
  
  /**
   * Update a workflow
   * @param {string} id - Workflow ID
   * @param {Object} properties - Properties to update
   * @returns {Object|null} Updated workflow or null if not found
   */
  updateWorkflow(id, properties) {
    if (!this.workflows[id]) {
      return null;
    }
    
    const updatedWorkflow = {
      ...this.workflows[id],
      ...properties,
      updatedAt: new Date().toISOString()
    };
    
    this.workflows[id] = updatedWorkflow;
    this.saveWorkflows();
    
    logger.info(`Workflow updated: ${updatedWorkflow.name} (${id})`);
    
    return updatedWorkflow;
  }
  
  /**
   * Delete a workflow
   * @param {string} id - Workflow ID
   * @returns {boolean} Success status
   */
  deleteWorkflow(id) {
    if (!this.workflows[id]) {
      return false;
    }
    
    const workflow = this.workflows[id];
    delete this.workflows[id];
    this.saveWorkflows();
    
    logger.info(`Workflow deleted: ${workflow.name} (${id})`);
    
    return true;
  }
  
  /**
   * Get all workflows
   * @returns {Object} All workflows
   */
  getAllWorkflows() {
    return this.workflows;
  }
  
  /**
   * Create a workflow template
   * @param {Object} template - Template data
   * @returns {Object} Created template
   */
  createTemplate(template) {
    if (!template.name) {
      throw new Error('Template name is required');
    }
    
    const templateId = template.id || uuidv4();
    
    const newTemplate = {
      id: templateId,
      name: template.name,
      description: template.description || '',
      phases: template.phases || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...template
    };
    
    this.templates[templateId] = newTemplate;
    this.saveTemplates();
    
    logger.info(`Workflow template created: ${newTemplate.name} (${templateId})`);
    
    return newTemplate;
  }
  
  /**
   * Get a workflow template by ID
   * @param {string} id - Template ID
   * @returns {Object|null} Template object or null if not found
   */
  getTemplate(id) {
    return this.templates[id] || null;
  }
  
  /**
   * Update a workflow template
   * @param {string} id - Template ID
   * @param {Object} properties - Properties to update
   * @returns {Object|null} Updated template or null if not found
   */
  updateTemplate(id, properties) {
    if (!this.templates[id]) {
      return null;
    }
    
    const updatedTemplate = {
      ...this.templates[id],
      ...properties,
      updatedAt: new Date().toISOString()
    };
    
    this.templates[id] = updatedTemplate;
    this.saveTemplates();
    
    logger.info(`Workflow template updated: ${updatedTemplate.name} (${id})`);
    
    return updatedTemplate;
  }
  
  /**
   * Delete a workflow template
   * @param {string} id - Template ID
   * @returns {boolean} Success status
   */
  deleteTemplate(id) {
    if (!this.templates[id]) {
      return false;
    }
    
    const template = this.templates[id];
    delete this.templates[id];
    this.saveTemplates();
    
    logger.info(`Workflow template deleted: ${template.name} (${id})`);
    
    return true;
  }
  
  /**
   * Get all workflow templates
   * @returns {Object} All templates
   */
  getAllTemplates() {
    return this.templates;
  }
  
  /**
   * Create default workflow templates
   */
  createDefaultTemplates() {
    try {
      // Create standard workflow template
      if (Object.keys(this.templates).length === 0) {
        this.createTemplate({
          name: 'Standard Development Workflow',
          description: 'Standard workflow for project development',
          phases: [
            {
              name: 'Structure Analysis',
              description: 'Analyze the current project structure',
              type: 'analysis',
              template: 'GenerateSTRUCTURE\'current\'.promptp',
              order: 1,
              dependencies: []
            },
            {
              name: 'Feature Suggestion',
              description: 'Suggest features for the project',
              type: 'analysis',
              template: 'generateSTRUCTURE\'suggested\'.prompt',
              order: 2,
              dependencies: ['Structure Analysis']
            },
            {
              name: 'Step Generation',
              description: 'Generate implementation steps',
              type: 'planning',
              template: 'GenerateSTEP.prompt',
              order: 3,
              dependencies: ['Feature Suggestion']
            },
            {
              name: 'Feature Implementation',
              description: 'Implement features',
              type: 'implementation',
              template: 'feature-implementation',
              order: 4,
              dependencies: ['Step Generation']
            },
            {
              name: 'Validation',
              description: 'Validate implemented features',
              type: 'validation',
              template: 'validation',
              order: 5,
              dependencies: ['Feature Implementation']
            }
          ]
        });
        
        logger.info('Created default workflow templates');
      }
    } catch (error) {
      logger.error(`Failed to create default templates: ${error.message}`);
    }
  }
  
  /**
   * Create a workflow from a template
   * @param {string} templateId - Template ID
   * @param {Object} workflowData - Additional workflow data
   * @returns {Object} Created workflow
   */
  createWorkflowFromTemplate(templateId, workflowData = {}) {
    const template = this.getTemplate(templateId);
    
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    // Create workflow from template
    const workflow = {
      name: workflowData.name || template.name,
      description: workflowData.description || template.description,
      projectId: workflowData.projectId,
      phases: JSON.parse(JSON.stringify(template.phases)), // Deep copy
      templateId
    };
    
    return this.createWorkflow(workflow);
  }
  
  /**
   * Execute a workflow
   * @param {string} workflowId - Workflow ID
   * @param {Object} context - Execution context
   * @returns {Object} Execution object
   */
  executeWorkflow(workflowId, context = {}) {
    const workflow = this.getWorkflow(workflowId);
    
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    const executionId = uuidv4();
    
    const execution = {
      id: executionId,
      workflowId,
      status: 'running',
      currentPhase: 0,
      phases: workflow.phases.map(phase => ({
        ...phase,
        status: 'pending',
        startedAt: null,
        completedAt: null,
        error: null
      })),
      context,
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null
    };
    
    this.executions[executionId] = execution;
    
    // Start execution
    setImmediate(() => this.executeNextPhase(executionId));
    
    logger.info(`Workflow execution started: ${workflow.name} (${executionId})`);
    
    return execution;
  }
  
  /**
   * Execute the next phase in a workflow
   * @param {string} executionId - Execution ID
   * @returns {Promise<boolean>} Success status
   */
  async executeNextPhase(executionId) {
    const execution = this.executions[executionId];
    
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }
    
    if (execution.status !== 'running') {
      return false;
    }
    
    // Find the next phase to execute
    const nextPhaseIndex = execution.phases.findIndex(phase => phase.status === 'pending');
    
    if (nextPhaseIndex === -1) {
      // All phases completed
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      
      this.emit('workflowCompleted', {
        executionId,
        workflowId: execution.workflowId,
        projectId: execution.context.projectId
      });
      
      logger.info(`Workflow execution completed: ${executionId}`);
      
      return true;
    }
    
    // Check if phase dependencies are met
    const phase = execution.phases[nextPhaseIndex];
    
    if (phase.dependencies && phase.dependencies.length > 0) {
      for (const depName of phase.dependencies) {
        const depPhase = execution.phases.find(p => p.name === depName);
        
        if (!depPhase || depPhase.status !== 'completed') {
          // Dependency not met
          logger.info(`Phase dependency not met: ${depName} for phase ${phase.name}`);
          return false;
        }
      }
    }
    
    // Execute phase
    execution.currentPhase = nextPhaseIndex;
    phase.status = 'running';
    phase.startedAt = new Date().toISOString();
    
    try {
      // Execute phase logic
      await this.executePhase(executionId, nextPhaseIndex);
      
      // Phase completed
      phase.status = 'completed';
      phase.completedAt = new Date().toISOString();
      
      this.emit('phaseCompleted', {
        executionId,
        workflowId: execution.workflowId,
        projectId: execution.context.projectId,
        phase
      });
      
      logger.info(`Phase completed: ${phase.name} for execution ${executionId}`);
      
      // Execute next phase
      setImmediate(() => this.executeNextPhase(executionId));
      
      return true;
    } catch (error) {
      // Phase failed
      phase.status = 'failed';
      phase.error = error.message;
      
      // Workflow failed
      execution.status = 'failed';
      execution.error = `Phase ${phase.name} failed: ${error.message}`;
      
      this.emit('workflowFailed', {
        executionId,
        workflowId: execution.workflowId,
        projectId: execution.context.projectId,
        phase,
        error: error.message
      });
      
      logger.error(`Phase failed: ${phase.name} for execution ${executionId}: ${error.message}`);
      
      return false;
    }
  }
  
  /**
   * Execute a specific phase
   * @param {string} executionId - Execution ID
   * @param {number} phaseIndex - Phase index
   * @returns {Promise<boolean>} Success status
   */
  async executePhase(executionId, phaseIndex) {
    const execution = this.executions[executionId];
    
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }
    
    const phase = execution.phases[phaseIndex];
    
    if (!phase) {
      throw new Error(`Phase not found at index ${phaseIndex}`);
    }
    
    // This is a simplified implementation
    // In a real implementation, you would:
    // 1. Get the phase template
    // 2. Process the template with context variables
    // 3. Execute the appropriate action based on phase type
    
    logger.info(`Executing phase: ${phase.name} for execution ${executionId}`);
    
    // Simulate phase execution
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return true;
  }
  
  /**
   * Get an execution by ID
   * @param {string} executionId - Execution ID
   * @returns {Object|null} Execution object or null if not found
   */
  getExecution(executionId) {
    return this.executions[executionId] || null;
  }
  
  /**
   * Get all executions
   * @returns {Object} All executions
   */
  getAllExecutions() {
    return this.executions;
  }
}

module.exports = WorkflowManager;