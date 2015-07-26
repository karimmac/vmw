#!/usr/bin/env node

var Q = require('q');
var _ = require('underscore');
var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');
var vmData = require('./vms.json')

var customCommands = {
  revert: revertVM,
  sharedfolders: enableSharedFolders
};

main();

function main() {
  var args = process.argv.slice(2);

  var command = {
    verb: args[0] || '',
    vmName: args[1],
    args: args.slice(2)
  };

  if (isHelp(command.verb)) {
    command.verb = '-?';
  }

  command.vmxPath = getVmxPath(command.vmName);

  if (!isValid(command)) {
    printHelp();
    return;
  }

  if (isCustom(command.verb)) {
    runCustom(command);
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
    .concat(command.args || []);

  return vmrun(args);
}

function runCustom(command) {
  var action = customCommands[command.verb.toLowerCase()];
  if (action) {
    action(command);
  }
}

function isCustom(verb) {
  return !!customCommands[verb.toLowerCase()];
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
    'removeSharedFolder',
    'renameFileInGuest',
    'runProgramInGuest',
    'runScriptInGuest',
    'setSharedFolderState'
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
  console.log('  ' + baseName + ' revert ' + keys + ' [on]');
  console.log('  ' + baseName + ' <cmd> ' + keys + ' <other args> # vmrun a command');
  console.log('  ' + baseName + ' help # Show vmrun help');
  console.log('');
}

function revertVM(command) {
  var autoStart = (command.args[0] === 'on');
  var snapshot = (command.args[1] || 'Base');
  vmrun(['listSnapshots', command.vmxPath])
    .then(function() { return vmrun(['revertToSnapshot', command.vmxPath, snapshot]); })
    .then(function() {
      if (autoStart) {
        return vmrun(['start', command.vmxPath]);
      }
    })
    .done();
}

function enableSharedFolders(command) {
  var c = { vmName: command.vmName, vmxPath: command.vmxPath };
  var enable = (command.args[0] === 'on');
  var enableVerb = (enable ? 'enable' : 'disable') + 'SharedFolders';

  runCommand(_.extend({verb: enableVerb}, c))
    .then(function() {
      return runCommand(_.extend({
        verb: 'writeVariable',
        args: ['runtimeConfig', 'hgfs.mapRootShare', enable.toString()]
      }, c));
    })
    .done();
}

function vmrun(args) {
  args = ['/Applications/VMware Fusion.app/Contents/Library/vmrun'].concat(args);
  args = _.map(args, function(v) {
    var arg = v.replace(/\\/g, '\\\\');
    arg = (arg.indexOf(' ') === -1) ? arg : '"' + arg.replace(/^\"(.*)\"$/, '$1') + '"';
    arg = (arg.length == 0) ? '""' : arg;
    return arg;
  });
  console.log(args.join(' '));

  var deferred = Q.defer();
  exec(args.join(' '), function(error, stdout) {
    if (error) {
      console.log('\n' + error);
      deferred.reject(new Error(error));
    } else {
      console.log(stdout);
      deferred.resolve(stdout);
    }
  });

  return deferred.promise;
}
