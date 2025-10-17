#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const candidatePaths = [
  path.join(
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
  ),
  path.join(
    __dirname,
    '..',
    'node_modules',
    'expo',
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
  ),
];

const executeBlockNeedles = [
  '      TaskManagerUtilsInterface taskManagerUtils = getTaskManagerUtils();\n\n      if (context != null) {\n        taskManagerUtils.executeTask(mTask, null, null);\n      }',
  '      TaskManagerUtilsInterface taskManagerUtils = getTaskManagerUtils();\n\n      if (context != null) {\n        Bundle emptyData = new Bundle();\n        taskManagerUtils.executeTask(mTask, emptyData, null);\n      }',
  '      TaskManagerUtilsInterface taskManagerUtils = getTaskManagerUtils();\n\n      if (context != null) {\n        Bundle emptyData = new Bundle();\n        taskManagerUtils.executeTask(mTask, emptyData);\n      }'
];

const replacementBlock =
  '      if (context != null) {\n' +
  '        mTask.execute(null, null, new TaskExecutionCallback() {\n' +
  '          @Override\n' +
  '          public void onFinished(Map<String, Object> response) {\n' +
  '            // no-op\n' +
  '          }\n' +
  '        });\n' +
  '      }';

let appliedToAny = false;

for (const filePath of candidatePaths) {
  if (!fs.existsSync(filePath)) {
    continue;
  }

  let source = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  let blockReplaced = false;
  for (const needle of executeBlockNeedles) {
    if (source.includes(needle)) {
      source = source.replace(needle, replacementBlock);
      blockReplaced = true;
      break;
    }
  }
  if (blockReplaced) {
    modified = true;
    source = source.replace(
      '      TaskManagerUtilsInterface taskManagerUtils = getTaskManagerUtils();\n\n      if (context != null) {\n        mTask.execute(null, null, new TaskExecutionCallback() {\n',
      '      if (context != null) {\n        mTask.execute(null, null, new TaskExecutionCallback() {\n'
    );
    source = source.replace('import android.os.Bundle;\n', '');
  }

  if (modified) {
    fs.writeFileSync(filePath, source, 'utf8');
    appliedToAny = true;
    console.log('[patch-background-fetch] Patched', filePath);
  }
}

if (!appliedToAny) {
  console.log('[patch-background-fetch] No changes applied.');
}
