'format cjs';

var wrap = require('word-wrap');
var map = require('lodash.map');
var longest = require('longest');
var chalk = require('chalk');
var branch = require('git-branch');

var filter = function(array) {
  return array.filter(function(x) {
    return x;
  });
};

var headerLength = function(answers) {
  return (
    answers.type.length + 2 + (answers.scope ? answers.scope.length + 2 : 0)
  );
};

var maxSummaryLength = function(options, answers) {
  return options.maxHeaderWidth - headerLength(answers);
};

var filterSubject = function(subject, disableSubjectLowerCase) {
  subject = subject.trim();
  if (
    !disableSubjectLowerCase &&
    subject.charAt(0).toLowerCase() !== subject.charAt(0)
  ) {
    subject =
      subject.charAt(0).toLowerCase() + subject.slice(1, subject.length);
  }
  while (subject.endsWith('.')) {
    subject = subject.slice(0, subject.length - 1);
  }
  return subject;
};

// This can be any kind of SystemJS compatible module.
// We use Commonjs here, but ES6 or AMD would do just
// fine.
module.exports = function(options) {
  var types = options.types;

  var length = longest(Object.keys(types)).length + 1;
  var choices = map(types, function(type, key) {
    return {
      name: (key + ':').padEnd(length) + ' ' + type.description,
      value: key
    };
  });

  // detect redmine id in branch name
  var branchName = branch.sync() || '';
  var redmineIdFound = branchName.match(/[0-9]+/) || [];
  var defaultRedmineId = redmineIdFound.shift();

  return {
    // When a user runs `git cz`, prompter will
    // be executed. We pass you cz, which currently
    // is just an instance of inquirer.js. Using
    // this you can ask questions and get answers.
    //
    // The commit callback should be executed when
    // you're ready to send back a commit template
    // to git.
    //
    // By default, we'll de-indent your commit
    // template and will keep empty lines.
    prompter: function(cz, commit) {
      // Let's ask some questions of the user
      // so that we can populate our commit
      // template.
      //
      // See inquirer.js docs for specifics.
      // You can also opt to use another input
      // collection library if you prefer.
      cz.prompt([
        {
          type: 'list',
          name: 'type',
          message: "Select the type of change that you're committing:",
          choices: choices,
          default: options.defaultType
        },
        {
          type: 'input',
          name: 'redmine',
          message:
            "REDMINE ID (e.g. 12345): (press enter to skip if you don't have one)",
          default: defaultRedmineId,
          validate: function(redmine) {
            if (!redmine) {
              return true;
            }
            return /^[0-9]+$/.test(redmine);
          },
          filter: function(redmine) {
            return redmine ? redmine.toUpperCase() : '';
          }
        },
        {
          type: 'input',
          name: 'scope',
          message:
            'What is the scope of this change (e.g. component or file name): (press enter to skip)',
          default: options.defaultScope,
          filter: function(value) {
            return options.disableScopeLowerCase
              ? value.trim()
              : value.trim().toLowerCase();
          }
        },
        {
          type: 'input',
          name: 'subject',
          message: function(answers) {
            return (
              'Write a short, imperative tense description of the change (max ' +
              maxSummaryLength(options, answers) +
              ' chars):\n'
            );
          },
          default: options.defaultSubject,
          validate: function(subject, answers) {
            var filteredSubject = filterSubject(
              subject,
              options.disableSubjectLowerCase
            );
            return filteredSubject.length == 0
              ? 'subject is required'
              : filteredSubject.length <= maxSummaryLength(options, answers)
              ? true
              : 'Subject length must be less than or equal to ' +
                maxSummaryLength(options, answers) +
                ' characters. Current length is ' +
                filteredSubject.length +
                ' characters.';
          },
          transformer: function(subject, answers) {
            var filteredSubject = filterSubject(
              subject,
              options.disableSubjectLowerCase
            );
            var color =
              filteredSubject.length <= maxSummaryLength(options, answers)
                ? chalk.green
                : chalk.red;
            return color('(' + filteredSubject.length + ') ' + subject);
          },
          filter: function(subject) {
            return filterSubject(subject, options.disableSubjectLowerCase);
          }
        },
        {
          type: 'input',
          name: 'body',
          message:
            'Provide a longer description of the change: (press enter to skip)\n',
          default: options.defaultBody
        }
      ]).then(function(answers) {
        var wrapOptions = {
          trim: true,
          cut: false,
          newline: '\n',
          indent: '',
          width: options.maxLineWidth
        };

        // parentheses are only needed when a scope is present
        var scope = answers.scope ? '(' + answers.scope + ')' : '';

        // redmine id will be injected into body
        var redmineid = answers.redmine ? wrap(answers.redmine, wrapOptions) : false;

        // Hard limit this line in the validate
        var head =
          answers.type +
          scope +
          ': ' +
          answers.subject +
          (answers.redmine ? ' [#' + answers.redmine + ']' : '');

        // Wrap these lines at options.maxLineWidth characters
        var body = answers.body ? wrap(answers.body, wrapOptions) : false;

        commit(filter([head, body]).join('\n\n'));
      });
    }
  };
};