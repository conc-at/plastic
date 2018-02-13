#!/usr/bin/env node

const Table = require('cli-table')
const program = require('commander')
const fs = require('fs')
const path = require('path')

const {
  document,
  getPrinter,
  getPrinters,
  getTemplate,
  print
} = require('./lib')

const pkg = require('./package.json')

const defaults = {
  templatePath: path.resolve(__dirname, 'templates'),
  outputPath: path.resolve(__dirname, 'output')
}

function stringify(data) {
  if (typeof data === 'object' && data.constructor === Error) {
    return JSON.stringify({
      name: data.name,
      message: data.message,
      stack: data.stack
    }, null, '  ')
  }
  return JSON.stringify(data, null, '  ')
}

function output(data, format = 'log') {
  switch (format) {
    case 'log':
      return console.log(data)
    case 'json':
      return console.log(stringify(data))
    default:
      console.log(data)
  }
}

program
  .version(pkg.version)
  .option('-f, --format [format]', 'Set output format', /^(json|log)$/i)
  .option('-t, --template-path [path]', 'Set template path')

program
  .command('printers')
  .description('Show available printer')
  .alias('ps')
  .action(() => {
    const table = new Table({
      head: ['ID', 'Name'],
      chars: {
        'top': '═',
        'top-mid': '╤',
        'top-left': '╔',
        'top-right': '╗',
        'bottom': '═',
        'bottom-mid': '╧',
        'bottom-left': '╚',
        'bottom-right': '╝',
        'left': '║',
        'left-mid': '╟',
        'mid': '─',
        'mid-mid': '┼',
        'right': '║',
        'right-mid': '╢',
        'middle': '│'
      }
    })

    const list = getPrinters()

    switch(program.format) {
      case 'json':
        return output(list, program.format)
        default:
          list.forEach((p, idx) => table.push([idx, p.name]))
          output(table.toString(), 'log')
    }
  })

program
  .command('print <template> <data>')
  .description('Print name on card')
  .alias('p')
  .option('-p, --printer <id>', 'Select printer, write to stdout by default')
  .option('-o, --output <path>', 'Write to file')
  .action(async (templateName, data, opts) => {
    try {
      const {
        template,
        options
      } = await getTemplate(defaults.templatePath, templateName)
      const json = JSON.parse(data)
      const base = `file://${defaults.templatePath}/${templateName}/`
      const stream = await document(template, json, {base, ...options})

      // print
      if (opts.printer) {
        return print(stream, opts.printer)
          .catch((err) => {
            output(
              {
                error: err.message
              },
              program.format
            )
          })
      }

      // write file
      if (opts.output) {
        const o = fs.createWriteStream(opts.output)
        stream.pipe(o)
      } else {
        stream.pipe(process.stdout)
      }
    } catch (err) {
      output(
        {
          error: err.message
        },
        program.format
      )
    }
  })

program
  .command('help')
  .description('Prints this help')
  .alias('h')
  .action(() => program.outputHelp())

program.parse(process.argv)

if (!process.argv.slice(2).length) {
  program.outputHelp()
}
