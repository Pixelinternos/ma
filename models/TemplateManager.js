/**
 * TemplateManager.js
 * Manages templates for project initialization, analysis, and development
 */

const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class TemplateManager {
  /**
   * Initialize the TemplateManager
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = {
      templatesDir: options.templatesDir || path.join(process.cwd(), 'templates'),
      enableVersioning: options.enableVersioning !== undefined ? options.enableVersioning : true,
      ...options
    };
    
    // Ensure templates directory exists
    fs.ensureDirSync(this.options.templatesDir);
    
    // Initialize template categories
    this.categories = {
      'initialization': 'Project initialization templates',
      'analysis': 'Project analysis templates',
      'implementation': 'Feature implementation templates',
      'validation': 'Validation and refinement templates',
      'custom': 'Custom templates'
    };
    
    // Load templates
    this.templates = this.loadTemplates();
    
    logger.info('TemplateManager initialized');
  }
  
  /**
   * Load templates from the templates directory
   * @returns {Object} Loaded templates
   */
  loadTemplates() {
    try {
      const templates = {};
      
      // Create category directories if they don't exist
      Object.keys(this.categories).forEach(category => {
        const categoryDir = path.join(this.options.templatesDir, category);
        fs.ensureDirSync(categoryDir);
      });
      
      // Load templates from each category
      Object.keys(this.categories).forEach(category => {
        const categoryDir = path.join(this.options.templatesDir, category);
        const files = fs.readdirSync(categoryDir);
        
        templates[category] = {};
        
        files.forEach(file => {
          if (file.endsWith('.template')) {
            const templateName = file.replace('.template', '');
            const templatePath = path.join(categoryDir, file);
            
            try {
              const content = fs.readFileSync(templatePath, 'utf8');
              const metadataPath = path.join(categoryDir, `${templateName}.metadata.json`);
              
              let metadata = {
                id: uuidv4(),
                name: templateName,
                category,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: '1.0.0'
              };
              
              if (fs.existsSync(metadataPath)) {
                try {
                  const storedMetadata = fs.readJsonSync(metadataPath);
                  metadata = { ...metadata, ...storedMetadata };
                } catch (metadataError) {
                  logger.warn(`Failed to parse metadata for template ${templateName}: ${metadataError.message}`);
                }
              }
              
              templates[category][templateName] = {
                content,
                metadata
              };
            } catch (templateError) {
              logger.error(`Failed to load template ${templateName}: ${templateError.message}`);
            }
          }
        });
      });
      
      logger.info('Templates loaded successfully');
      return templates;
    } catch (error) {
      logger.error(`Failed to load templates: ${error.message}`);
      return {};
    }
  }
  
  /**
   * Get all templates
   * @returns {Object} All templates organized by category
   */
  getAllTemplates() {
    return this.templates;
  }
  
  /**
   * Get templates by category
   * @param {string} category - Template category
   * @returns {Object} Templates in the category
   */
  getTemplatesByCategory(category) {
    return this.templates[category] || {};
  }
  
  /**
   * Get a specific template
   * @param {string} category - Template category
   * @param {string} name - Template name
   * @returns {Object|null} Template object or null if not found
   */
  getTemplate(category, name) {
    if (!this.templates[category] || !this.templates[category][name]) {
      return null;
    }
    
    return this.templates[category][name];
  }
  
  /**
   * Create a new template
   * @param {string} category - Template category
   * @param {string} name - Template name
   * @param {string} content - Template content
   * @param {Object} metadata - Template metadata
   * @returns {Object} Created template
   */
  createTemplate(category, name, content, metadata = {}) {
    if (!this.categories[category]) {
      throw new Error(`Invalid category: ${category}`);
    }
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new Error('Template name is required');
    }
    
    if (!content || typeof content !== 'string') {
      throw new Error('Template content is required');
    }
    
    // Check if template already exists
    if (this.templates[category] && this.templates[category][name]) {
      throw new Error(`Template ${name} already exists in category ${category}`);
    }
    
    // Create template metadata
    const templateMetadata = {
      id: metadata.id || uuidv4(),
      name,
      category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
      ...metadata
    };
    
    // Save template
    const categoryDir = path.join(this.options.templatesDir, category);
    fs.ensureDirSync(categoryDir);
    
    const templatePath = path.join(categoryDir, `${name}.template`);
    const metadataPath = path.join(categoryDir, `${name}.metadata.json`);
    
    fs.writeFileSync(templatePath, content);
    fs.writeJsonSync(metadataPath, templateMetadata, { spaces: 2 });
    
    // Update in-memory templates
    if (!this.templates[category]) {
      this.templates[category] = {};
    }
    
    this.templates[category][name] = {
      content,
      metadata: templateMetadata
    };
    
    logger.info(`Template created: ${category}/${name}`);
    
    return this.templates[category][name];
  }
  
  /**
   * Update an existing template
   * @param {string} category - Template category
   * @param {string} name - Template name
   * @param {string} content - New template content
   * @param {Object} metadata - Updated metadata
   * @returns {Object} Updated template
   */
  updateTemplate(category, name, content, metadata = {}) {
    // Check if template exists
    if (!this.templates[category] || !this.templates[category][name]) {
      throw new Error(`Template ${name} not found in category ${category}`);
    }
    
    const existingTemplate = this.templates[category][name];
    
    // Create new version if versioning is enabled
    if (this.options.enableVersioning) {
      const versionDir = path.join(this.options.templatesDir, '_versions', category);
      fs.ensureDirSync(versionDir);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const versionPath = path.join(versionDir, `${name}.${timestamp}.template`);
      
      fs.writeFileSync(versionPath, existingTemplate.content);
      
      // Increment version
      const version = existingTemplate.metadata.version || '1.0.0';
      const versionParts = version.split('.').map(Number);
      versionParts[2] += 1;
      metadata.version = versionParts.join('.');
    }
    
    // Update template metadata
    const updatedMetadata = {
      ...existingTemplate.metadata,
      updatedAt: new Date().toISOString(),
      ...metadata
    };
    
    // Save updated template
    const categoryDir = path.join(this.options.templatesDir, category);
    const templatePath = path.join(categoryDir, `${name}.template`);
    const metadataPath = path.join(categoryDir, `${name}.metadata.json`);
    
    fs.writeFileSync(templatePath, content);
    fs.writeJsonSync(metadataPath, updatedMetadata, { spaces: 2 });
    
    // Update in-memory template
    this.templates[category][name] = {
      content,
      metadata: updatedMetadata
    };
    
    logger.info(`Template updated: ${category}/${name}`);
    
    return this.templates[category][name];
  }
  
  /**
   * Delete a template
   * @param {string} category - Template category
   * @param {string} name - Template name
   * @returns {boolean} Success status
   */
  deleteTemplate(category, name) {
    // Check if template exists
    if (!this.templates[category] || !this.templates[category][name]) {
      throw new Error(`Template ${name} not found in category ${category}`);
    }
    
    // Archive template if versioning is enabled
    if (this.options.enableVersioning) {
      const archiveDir = path.join(this.options.templatesDir, '_archive', category);
      fs.ensureDirSync(archiveDir);
      
      const templatePath = path.join(this.options.templatesDir, category, `${name}.template`);
      const metadataPath = path.join(this.options.templatesDir, category, `${name}.metadata.json`);
      
      const archiveTemplatePath = path.join(archiveDir, `${name}.template`);
      const archiveMetadataPath = path.join(archiveDir, `${name}.metadata.json`);
      
      if (fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, archiveTemplatePath);
      }
      
      if (fs.existsSync(metadataPath)) {
        fs.copyFileSync(metadataPath, archiveMetadataPath);
      }
    }
    
    // Delete template files
    const templatePath = path.join(this.options.templatesDir, category, `${name}.template`);
    const metadataPath = path.join(this.options.templatesDir, category, `${name}.metadata.json`);
    
    if (fs.existsSync(templatePath)) {
      fs.unlinkSync(templatePath);
    }
    
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
    }
    
    // Remove from in-memory templates
    delete this.templates[category][name];
    
    logger.info(`Template deleted: ${category}/${name}`);
    
    return true;
  }
  
  /**
   * Process a template with variables
   * @param {string} category - Template category
   * @param {string} name - Template name
   * @param {Object} variables - Variables to replace in the template
   * @returns {string} Processed template content
   */
  processTemplate(category, name, variables = {}) {
    const template = this.getTemplate(category, name);
    
    if (!template) {
      throw new Error(`Template ${name} not found in category ${category}`);
    }
    
    let content = template.content;
    
    // Replace variables in the format {{variableName}}
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      content = content.replace(regex, value);
    });
    
    // Replace any remaining variables with empty string
    content = content.replace(/{{.*?}}/g, '');
    
    return content;
  }
  
  /**
   * Extract variables from a template
   * @param {string} category - Template category
   * @param {string} name - Template name
   * @returns {Array<string>} List of variable names
   */
  extractTemplateVariables(category, name) {
    const template = this.getTemplate(category, name);
    
    if (!template) {
      throw new Error(`Template ${name} not found in category ${category}`);
    }
    
    const content = template.content;
    const variableRegex = /{{(.*?)}}/g;
    const variables = new Set();
    
    let match;
    while ((match = variableRegex.exec(content)) !== null) {
      variables.add(match[1].trim());
    }
    
    return Array.from(variables);
  }
  
  /**
   * Create default templates if they don't exist
   */
  createDefaultTemplates() {
    try {
      // Create default templates for each category
      
      // Initialization template
      if (!this.getTemplate('initialization', 'default')) {
        this.createTemplate('initialization', 'default', 
          `# Project Initialization: {{projectName}}

## Overview
This is the initialization template for {{projectName}}.

## Repository Structure
- src/
  - components/
  - utils/
  - services/
- public/
- docs/

## Getting Started
1. Clone the repository
2. Install dependencies
3. Start the development server

## Requirements
Please define the project requirements in REQUIREMENTS.md.
`, 
          { description: 'Default project initialization template' }
        );
      }
      
      // Analysis template
      if (!this.getTemplate('analysis', 'default')) {
        this.createTemplate('analysis', 'default', 
          `# Project Analysis: {{projectName}}

## Current Structure
Please analyze the current structure of {{projectName}} and provide a detailed overview.

## Suggested Improvements
Based on your analysis, suggest improvements to the project structure and architecture.

## Feature Recommendations
Recommend features that would enhance the project's functionality and user experience.
`, 
          { description: 'Default project analysis template' }
        );
      }
      
      // Implementation template
      if (!this.getTemplate('implementation', 'default')) {
        this.createTemplate('implementation', 'default', 
          `# Feature Implementation: {{featureName}}

## Overview
Implement the {{featureName}} feature for {{projectName}}.

## Requirements
{{featureRequirements}}

## Implementation Guidelines
- Follow the project's coding standards
- Write clean, maintainable code
- Include appropriate tests
- Document your code

## Deliverables
- Implementation of the feature
- Tests for the feature
- Documentation for the feature

## Response Format
Please include the tag [FEATURE:{{featureId}}] in your response to help us track this implementation.
`, 
          { description: 'Default feature implementation template' }
        );
      }
      
      // Validation template
      if (!this.getTemplate('validation', 'default')) {
        this.createTemplate('validation', 'default', 
          `# Feature Validation: {{featureName}}

## Overview
Validate the implementation of {{featureName}} for {{projectName}}.

## Requirements
{{featureRequirements}}

## Validation Criteria
- Code quality
- Test coverage
- Documentation
- Adherence to requirements

## Response Format
Please include the tag [VALIDATION:{{featureId}}] in your response to help us track this validation.
`, 
          { description: 'Default feature validation template' }
        );
      }
      
      logger.info('Default templates created');
    } catch (error) {
      logger.error(`Failed to create default templates: ${error.message}`);
    }
  }
}

module.exports = TemplateManager;