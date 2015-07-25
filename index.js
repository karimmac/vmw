#!/usr/bin/env node

var Q = require('q');
var _ = require('underscore');
var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');
var vmData = require('./vms.json')

main();

function main() {
  var args = process.argv.slice(2);

  var command = {
    verb: args[0] || '',
    vmName: args[1],
    args: args.slice(2) || []
  };

  if (isHelp(command.verb)) {
    command.verb = '-?';
  }

  command.vmxPath = getVmxPath(command.vmName);

  if (!isValid(command)) {
    printHelp();
    return;
  }

  if (command.verb == 'reset') {
    resetVM(command.vmxPath, command.args[0]);
  } else {
    runCommand(command);
  }
}

function runCommand(command) {
  var args = [];

  if (requiresAuth(command.verb)) {
    args = args.concat(getCredentials(command.vmName));
  }

  args = args
    .concat(command.verb)
    .concat(command.vmxPath || [])
    .concat(command.args);

  vmrun(args);
}

function isValid(command) {
  if (requiresVmxPath(command.verb) && !command.vmxPath) {
    return false;
  }

  return true;
}

function isHelp(verb) {
  return _.contains(['help', '?'], verb.toLowerCase().replace(/^-+/,''));
}

function requiresVmxPath(verb) {
  return !_.contains(['-?', 'list'], verb);
}

function requiresAuth(verb) {
  return _.contains([
    'CopyFileFromGuestToHost',
    'CopyFileFromHostToGuest',
    'CreateTempfileInGuest',
    'addSharedFolder',
    'createDirectoryInGuest',
    'deleteDirectoryInGuest',
    'deleteFileInGuest',
    'directoryExistsInGuest',
    'disableSharedFolders',
    'enableSharedFolders',
    'fileExistsInGuest',
    'killProcessInGuest',
    'listDirectoryInGuest',
    'listProcessesInGuest',
    'readVariable',
    'removeSharedFolder',
    'renameFileInGuest',
    'runProgramInGuest',
    'runScriptInGuest',
    'setSharedFolderState',
    'writeVariable'
  ], verb);
}

function getCredentials(name) {
  var data = vmData[name];

  if (data && data.username && data.password) {
    return ['-gu', data.username, '-gp', data.password];
  } else {
    return [];
  }
}

function getVmxPath(name) {
  return (vmData[name] || {}).path;
}

function printHelp() {
  var keys = _.keys(vmData).join('|');
  var baseName = path.basename(process.argv[1]);

  console.log('Usage:');
  console.log('  ' + baseName + ' reset ' + keys + ' [on]');
  console.log('  ' + baseName + ' <cmd> ' + keys + ' <other args> # vmrun a command');
  console.log('  ' + baseName + ' help # Show vmrun help');
  console.log('');
}

function resetVM(vmxPath, autoStart) {
  autoStart = (autoStart === 'on');
  vmrun(['listSnapshots', vmxPath])
    .then(function() { return vmrun(['revertToSnapshot', vmxPath, 'Base']); })
    .then(function() {
      if (autoStart) {
        return vmrun(['start', vmxPath]);
      }
    })
  .done();
}

function vmrun(args) {
  args = ['/Applications/VMware Fusion.app/Contents/Library/vmrun'].concat(args);
  args = _.map(args, function(v) {
    var arg = v.trim();
    return (arg.indexOf(' ') === -1) ? arg : '"' + arg.replace(/^\"(.*)\"$/, '$1') + '"';
  });
  console.log(args.join(' '));

  var deferred = Q.defer();
  exec(args.join(' '), function(error, stdout) {
    if (error) {
      deferred.reject(new Error(error));
    } else {
      console.log(stdout);
      deferred.resolve(stdout);
    }
  });

  return deferred.promise;
}
