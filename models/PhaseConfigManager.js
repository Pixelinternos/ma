/**
 * PhaseConfigManager.js
 * Manages phase configurations for projects
 */

const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class PhaseConfigManager {
  /**
   * Initialize the PhaseConfigManager
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = {
      configDir: options.configDir || path.join(process.cwd(), 'config'),
      phasesFile: options.phasesFile || 'phases.json',
      ...options
    };
    
    // Ensure config directory exists
    fs.ensureDirSync(this.options.configDir);
    
    // Initialize phases
    this.phases = [];
    
    // Load phases
    this.loadPhases();
    
    logger.info('PhaseConfigManager initialized');
  }
  
  /**
   * Load phases from the phases file
   */
  loadPhases() {
    try {
      const phasesPath = path.join(this.options.configDir, this.options.phasesFile);
      
      if (fs.existsSync(phasesPath)) {
        this.phases = fs.readJsonSync(phasesPath);
        logger.info(`Loaded ${this.phases.length} phases`);
      } else {
        this.phases = [];
        this.savePhases();
        logger.info('Created empty phases file');
      }
    } catch (error) {
      logger.error(`Failed to load phases: ${error.message}`);
      this.phases = [];
    }
  }
  
  /**
   * Save phases to the phases file
   */
  savePhases() {
    try {
      const phasesPath = path.join(this.options.configDir, this.options.phasesFile);
      fs.writeJsonSync(phasesPath, this.phases, { spaces: 2 });
    } catch (error) {
      logger.error(`Failed to save phases: ${error.message}`);
    }
  }
  
  /**
   * Get all phases
   * @param {Object} filter - Filter criteria
   * @returns {Array} Phases matching the filter
   */
  getPhases(filter = {}) {
    if (Object.keys(filter).length === 0) {
      return this.phases;
    }
    
    return this.phases.filter(phase => {
      for (const [key, value] of Object.entries(filter)) {
        if (phase[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }
  
  /**
   * Get a phase by ID
   * @param {string} id - Phase ID
   * @returns {Object|null} Phase object or null if not found
   */
  getPhaseById(id) {
    return this.phases.find(phase => phase.id === id) || null;
  }
  
  /**
   * Create a new phase
   * @param {Object} phase - Phase data
   * @returns {Object} Created phase
   */
  createPhase(phase) {
    if (!phase.name) {
      throw new Error('Phase name is required');
    }
    
    const newPhase = {
      id: phase.id || uuidv4(),
      name: phase.name,
      description: phase.description || '',
      projectId: phase.projectId || null,
      type: phase.type || 'default',
      order: phase.order || this.phases.length + 1,
      template: phase.template || null,
      dependencies: phase.dependencies || [],
      status: phase.status || 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...phase
    };
    
    this.phases.push(newPhase);
    this.savePhases();
    
    logger.info(`Phase created: ${newPhase.name} (${newPhase.id})`);
    
    return newPhase;
  }
  
  /**
   * Update a phase
   * @param {string} id - Phase ID
   * @param {Object} properties - Properties to update
   * @returns {Object|null} Updated phase or null if not found
   */
  updatePhase(id, properties) {
    const index = this.phases.findIndex(phase => phase.id === id);
    
    if (index === -1) {
      return null;
    }
    
    const updatedPhase = {
      ...this.phases[index],
      ...properties,
      updatedAt: new Date().toISOString()
    };
    
    this.phases[index] = updatedPhase;
    this.savePhases();
    
    logger.info(`Phase updated: ${updatedPhase.name} (${updatedPhase.id})`);
    
    return updatedPhase;
  }
  
  /**
   * Delete a phase
   * @param {string} id - Phase ID
   * @returns {boolean} Success status
   */
  deletePhase(id) {
    const index = this.phases.findIndex(phase => phase.id === id);
    
    if (index === -1) {
      return false;
    }
    
    const deletedPhase = this.phases[index];
    this.phases.splice(index, 1);
    this.savePhases();
    
    logger.info(`Phase deleted: ${deletedPhase.name} (${deletedPhase.id})`);
    
    return true;
  }
  
  /**
   * Get phases for a project
   * @param {string} projectId - Project ID
   * @returns {Array} Project phases
   */
  getProjectPhases(projectId) {
    return this.phases.filter(phase => phase.projectId === projectId);
  }
  
  /**
   * Create default phases for a project
   * @param {string} projectId - Project ID
   * @param {string} projectName - Project name
   * @returns {Array} Created phases
   */
  createDefaultPhases(projectId, projectName) {
    const defaultPhases = [
      {
        name: 'Structure Analysis',
        description: 'Analyze the current project structure',
        type: 'analysis',
        template: 'GenerateSTRUCTURE\'current\'.promptp',
        projectId,
        order: 1
      },
      {
        name: 'Feature Suggestion',
        description: 'Suggest features for the project',
        type: 'analysis',
        template: 'generateSTRUCTURE\'suggested\'.prompt',
        projectId,
        order: 2,
        dependencies: []
      },
      {
        name: 'Step Generation',
        description: 'Generate implementation steps',
        type: 'planning',
        template: 'GenerateSTEP.prompt',
        projectId,
        order: 3,
        dependencies: []
      },
      {
        name: 'Feature Implementation',
        description: 'Implement features',
        type: 'implementation',
        template: 'feature-implementation',
        projectId,
        order: 4,
        dependencies: []
      },
      {
        name: 'Validation',
        description: 'Validate implemented features',
        type: 'validation',
        template: 'validation',
        projectId,
        order: 5,
        dependencies: []
      }
    ];
    
    const createdPhases = [];
    
    for (const phase of defaultPhases) {
      const createdPhase = this.createPhase({
        ...phase,
        projectName
      });
      
      createdPhases.push(createdPhase);
      
      // Update dependencies to use created phase IDs
      if (phase.order > 1) {
        const previousPhase = createdPhases[phase.order - 2];
        this.updatePhase(createdPhase.id, {
          dependencies: [previousPhase.id]
        });
      }
    }
    
    logger.info(`Created ${createdPhases.length} default phases for project ${projectId}`);
    
    return createdPhases;
  }
  
  /**
   * Update phase order for a project
   * @param {string} projectId - Project ID
   * @param {Array<string>} phaseIds - Ordered array of phase IDs
   * @returns {boolean} Success status
   */
  updatePhaseOrder(projectId, phaseIds) {
    try {
      // Get project phases
      const projectPhases = this.getProjectPhases(projectId);
      
      // Validate that all phase IDs belong to the project
      const projectPhaseIds = projectPhases.map(phase => phase.id);
      const invalidIds = phaseIds.filter(id => !projectPhaseIds.includes(id));
      
      if (invalidIds.length > 0) {
        throw new Error(`Invalid phase IDs: ${invalidIds.join(', ')}`);
      }
      
      // Update order for each phase
      phaseIds.forEach((id, index) => {
        this.updatePhase(id, { order: index + 1 });
      });
      
      logger.info(`Updated phase order for project ${projectId}`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to update phase order: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get the next phase for a project
   * @param {string} projectId - Project ID
   * @param {string} currentPhaseId - Current phase ID
   * @returns {Object|null} Next phase or null if no next phase
   */
  getNextPhase(projectId, currentPhaseId) {
    // Get project phases
    const projectPhases = this.getProjectPhases(projectId);
    
    // Sort by order
    const sortedPhases = [...projectPhases].sort((a, b) => a.order - b.order);
    
    // Find current phase index
    const currentIndex = sortedPhases.findIndex(phase => phase.id === currentPhaseId);
    
    if (currentIndex === -1 || currentIndex === sortedPhases.length - 1) {
      return null;
    }
    
    return sortedPhases[currentIndex + 1];
  }
  
  /**
   * Get phases that depend on a specific phase
   * @param {string} phaseId - Phase ID
   * @returns {Array} Dependent phases
   */
  getDependentPhases(phaseId) {
    return this.phases.filter(phase => 
      phase.dependencies && phase.dependencies.includes(phaseId)
    );
  }
  
  /**
   * Check if a phase is ready to start
   * @param {string} phaseId - Phase ID
   * @returns {boolean} Whether the phase is ready
   */
  isPhaseReady(phaseId) {
    const phase = this.getPhaseById(phaseId);
    
    if (!phase) {
      return false;
    }
    
    // If no dependencies, phase is ready
    if (!phase.dependencies || phase.dependencies.length === 0) {
      return true;
    }
    
    // Check if all dependencies are completed
    for (const depId of phase.dependencies) {
      const depPhase = this.getPhaseById(depId);
      
      if (!depPhase || depPhase.status !== 'completed') {
        return false;
      }
    }
    
    return true;
  }
}

module.exports = PhaseConfigManager;