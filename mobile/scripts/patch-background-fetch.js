#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-background-fetch',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'backgroundfetch',
  'BackgroundFetchTaskConsumer.java'
);

if (!fs.existsSync(filePath)) {
  console.warn('[patch-background-fetch] Target file not found:', filePath);
  process.exit(0);
}

let source = fs.readFileSync(filePath, 'utf8');

const importNeedle = 'import expo.modules.core.interfaces.LifecycleEventListener;';
const importPatch = 'import android.os.Bundle;\n\nimport expo.modules.core.interfaces.LifecycleEventListener;';
const executeNeedle = 'taskManagerUtils.executeTask(mTask, null, null);';
const executePatch = 'Bundle emptyData = new Bundle();\n        taskManagerUtils.executeTask(mTask, emptyData, null);';

let modified = false;

if (!source.includes('Bundle emptyData = new Bundle();')) {
  if (source.includes(executeNeedle)) {
    source = source.replace(executeNeedle, executePatch);
    modified = true;
  } else {
    console.warn('[patch-background-fetch] Expected executeTask call not found; skipping bundle patch.');
  }
}

if (!source.includes('import android.os.Bundle;')) {
  if (source.includes(importNeedle)) {
    source = source.replace(importNeedle, importPatch);
    modified = true;
  } else {
    console.warn('[patch-background-fetch] Expected import sentinel not found; skipping import patch.');
  }
}

if (modified) {
  fs.writeFileSync(filePath, source, 'utf8');
  console.log('[patch-background-fetch] Applied BackgroundFetchTaskConsumer patch.');
} else {
  console.log('[patch-background-fetch] No changes needed.');
}
