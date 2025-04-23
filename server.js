/**
 * server.js
 * Main server file for the Depla Project Manager
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');
const logger = require('./utils/logger');
const DeplaEnhanced = require('./models/DeplaEnhanced');
const ConfigManager = require('./framework/ConfigManager');

// Initialize components
const configManager = new ConfigManager();
const config = configManager.getConfig();
const depla = new DeplaEnhanced();

// Create Express app
const app = express();
const PORT = config.server?.port || 3000;

// Configure middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize depla
depla.initialize().then(result => {
  if (result.success) {
    logger.info('Depla initialized successfully');
  } else {
    logger.error(`Depla initialization failed: ${result.error}`);
  }
});

// API routes

// Projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await depla.multiProjectManager.getProjectsStatus();
    res.json({ success: true, projects });
  } catch (error) {
    logger.error('Failed to get projects', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { repoUrl, projectName } = req.body;
    const project = await depla.addProject(repoUrl, projectName);
    res.json({ success: true, project });
  } catch (error) {
    logger.error('Failed to add project', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/projects/create', async (req, res) => {
  try {
    const result = await depla.multiProjectManager.createProject(req.body);
    res.json(result);
  } catch (error) {
    logger.error('Failed to create project', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await depla.multiProjectManager.getProjectStatus(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, project });
  } catch (error) {
    logger.error(`Failed to get project ${req.params.id}`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/projects/:id/initialize', async (req, res) => {
  try {
    const success = await depla.multiProjectManager.initializeProject(req.params.id);
    res.json({ success });
  } catch (error) {
    logger.error(`Failed to initialize project ${req.params.id}`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cursor positions
app.get('/api/cursor-positions', (req, res) => {
  try {
    const positions = depla.getCursorPositions();
    res.json({ success: true, positions });
  } catch (error) {
    logger.error('Failed to get cursor positions', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/cursor-positions', async (req, res) => {
  try {
    const { name, coordinates, metadata } = req.body;
    const position = depla.saveCursorPosition(name, coordinates, metadata);
    res.json({ success: true, position });
  } catch (error) {
    logger.error('Failed to save cursor position', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/cursor-positions/capture', async (req, res) => {
  try {
    const { name, metadata } = req.body;
    const position = await depla.captureCursorPosition(name, metadata);
    res.json({ success: true, position });
  } catch (error) {
    logger.error('Failed to capture cursor position', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/cursor-positions/:name', (req, res) => {
  try {
    const success = depla.deleteCursorPosition(req.params.name);
    res.json({ success });
  } catch (error) {
    logger.error(`Failed to delete cursor position ${req.params.name}`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Messages
app.post('/api/messages', async (req, res) => {
  try {
    const { message, priority } = req.body;
    const result = await depla.sendMessage(message, priority);
    res.json(result);
  } catch (error) {
    logger.error('Failed to send message', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/messages/batch', async (req, res) => {
  try {
    const { messages, priority } = req.body;
    const result = await depla.sendMessageBatch(messages, priority);
    res.json(result);
  } catch (error) {
    logger.error('Failed to send message batch', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/messages/queue', (req, res) => {
  try {
    const queueStatus = depla.getQueueStatus();
    res.json({ success: true, queueStatus });
  } catch (error) {
    logger.error('Failed to get queue status', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/messages/queue/pause', (req, res) => {
  try {
    const result = depla.pauseMessageProcessing();
    res.json(result);
  } catch (error) {
    logger.error('Failed to pause message processing', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/messages/queue/resume', (req, res) => {
  try {
    const result = depla.resumeMessageProcessing();
    res.json(result);
  } catch (error) {
    logger.error('Failed to resume message processing', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Components
app.post('/api/components/parse', async (req, res) => {
  try {
    const { projectId, phaseNumber } = req.body;
    const result = await depla.parseStepByStepComponents(projectId, phaseNumber);
    res.json(result);
  } catch (error) {
    logger.error('Failed to parse components', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/components/messages', async (req, res) => {
  try {
    const { projectId, phaseNumber, inputPosition } = req.body;
    const result = await depla.createComponentMessages(projectId, phaseNumber, inputPosition);
    res.json(result);
  } catch (error) {
    logger.error('Failed to create component messages', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Configuration
app.get('/api/config', (req, res) => {
  try {
    const config = configManager.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    logger.error('Failed to get configuration', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/config', (req, res) => {
  try {
    const result = depla.updateConfig(req.body);
    res.json(result);
  } catch (error) {
    logger.error('Failed to update configuration', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Automation
app.get('/api/automation/status', (req, res) => {
  try {
    const status = depla.getAutomationStatus();
    res.json({ success: true, status });
  } catch (error) {
    logger.error('Failed to get automation status', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/automation/start', (req, res) => {
  try {
    depla.setupAutomation();
    res.json({ success: true, message: 'Automation started' });
  } catch (error) {
    logger.error('Failed to start automation', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/automation/stop', (req, res) => {
  try {
    depla.stopAutomation();
    res.json({ success: true, message: 'Automation stopped' });
  } catch (error) {
    logger.error('Failed to stop automation', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Server shutting down');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});