#!/usr/bin/env node

var Q = require('q');
var _ = require('underscore');
var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');

var vmData = {};

main();

function main() {
  var file = __dirname + '/vms.json';

  fs.readFile(file, 'utf8', function(err, data) {
    if (err) {
      console.log('' + err);
      return;
    }

    var args = process.argv.slice(2);
    vmData = JSON.parse(data);

    var command = (args[0] || '').toLowerCase();
    if (isHelp(command)) {
      args[0] = '-?';
    }

    var vmxPath = getVmxPath(args[1]);
    if (args[1] && !vmxPath) {
      printHelp();
      return;
    }

    switch (command) {
      case 'reset':
        resetVM(vmxPath, args[2]);
        break;

      case '':
        printHelp();
        break;

      default:
        if (vmxPath) {
          args[1] = vmxPath;
        }
        vmrun(args);
    }
  });
}

function isHelp(command) {
  return _.contains(
    ['help', '?'],
    command.replace(/^-+/,'')
  );
}

function getVmxPath(name) {
  return vmData[name];
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

