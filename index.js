#!/usr/bin/env node

const Table = require('cli-table')
const program = require('commander')
const fs = require('fs')
const Handlebars = require('handlebars')
const pdf = require('html-pdf')
const isNumber = require('lodash/isNumber')
const path = require('path')
const printer = require('printer')
const {promisify} = require('util')
const slug = require('slug')

const pkg = require('./package.json')

const readFile = promisify(fs.readFile)

function getPrinterById(id) {
  if (isNumber(parseInt(id))) {
    const printers = printer.getPrinters()
    return printers[parseInt(id)]
  }

  return printer.getPrinter(id)
}

async function getTemplate(name) {
  const base = path.resolve(__dirname, 'templates', name)
  const file = path.resolve(base, 'template.hbs')
  const opts = require(path.resolve(base, 'options.json'))
  const buffer = await readFile(file)
  return {
    template: Handlebars.compile(buffer.toString()),
    options: {base: `file://${base}/`, ...opts}
  }
}

program
  .version(pkg.version)

program
  .command('printer')
  .description('Show available printer')
  .alias('ps')
  .action(() => {
    const table = new Table({
      head: ['ID', 'Name'],
      chars: {
        'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
        'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
        'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
        'right': '║', 'right-mid': '╢', 'middle': '│'
      }
    })

    const printers = printer.getPrinters()
    printers.forEach((p, idx) => table.push([idx, p.name]))

    console.log(table.toString())
  })

program
  .command('print <printer> <template> <name>')
  .description('Print name on card')
  .alias('p')
  .action(async (printerId, templateName, name) => {
    const p = getPrinterById(printerId)

    const {
      template,
      options
    } = await getTemplate(templateName)

    pdf
      .create(template({name}), options)
      .toBuffer((err, buffer) => {
        const params = {
          data: buffer,
          docname: `${template}-${slug(name)}`,
          printer: p.name,
          type: 'RAW',
          success: (jobId) => console.log(`Sent print job: ${jobId}`),
          error: (err) => console.error(err)
        }
        printer.printDirect(params)
      })
  })

program
  .command('print-to-file <template> <name> [path]')
  .description('Print name on card but output as PDF')
  .alias('ptf')
  .action(async (templateName, name, toPath) => {
    const {
      template,
      options
    } = await getTemplate(templateName)

    const html = pdf
      .create(template({name}), options)

    const filePath = toPath
      ? toPath
      : path.resolve(__dirname, 'output', `${slug(name)}.pdf`)

    html
      .toFile(filePath, (err, res) => {
        if (err) {
          return console.error(err.message)
        }
        console.log(`Print to file successfull: ${res.filename}`)
      })
  })

program
  .command('print-file <printer> <file>')
  .description('Print file')
  .alias('pf')
  .action((printerId, filename) => {
    const p = getPrinterById(printerId)
    const parameters = {
      filename,
      docname: `${slug(filename)}`,
      printer: p.name,
      success: (jobId) => console.log(`Sent print job: ${jobId}`),
      error: (err) => console.error(err)
    }

    printer.printFile(parameters)
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
