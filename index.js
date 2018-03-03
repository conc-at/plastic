#!/usr/bin/env node

const Table = require('cli-table')
const program = require('commander')
const CSV = require('comma-separated-values')
const fs = require('fs')
const isArray = require('lodash/isArray')
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
  .option('-i, --input [type]', 'Set input type of data [json]', 'json')
  .action(async (templateName, data, opts) => {
    try {
      const {
        template,
        options
      } = await getTemplate(defaults.templatePath, templateName)
      
      let parsedData
      switch(opts.input) {
        case 'json':
          parsedData = JSON.parse(data)
          break
        case 'csv':
          const file = fs.readFileSync(data, 'utf8');
          parsedData = CSV
            .parse(file)
            .map((row) => ({firstname: row[0], lastname: row[1]}))
          break
        default:
          throw new Error(`Invalid input format: "${opts.input}"`)
      }
      
      const base = `file://${defaults.templatePath}/${templateName}/`
      const stream = await document(template, parsedData, {base, ...options})

      if (isArray(parsedData) && !opts.printer) {
        throw new Error('Multiple documents can only be sent to the print queue. File output is not supported.')
      }

      // print multiple documents
      if (isArray(parsedData)) {
        parsedData.forEach(async (d) => {
          const stream = await document(template, d, {base, ...options})
          print(stream, opts.printer)
            .catch((err) => {
              output(
                {
                  error: err.message
                },
                program.format
              )
            })
        })

        return
      }

      // print single document
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

      // write single file
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
