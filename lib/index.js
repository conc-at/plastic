const fs = require('fs')
const Handlebars = require('handlebars')
const pdf = require('html-pdf')
const isNumber = require('lodash/isNumber')
const path = require('path')
const printer = require('printer')
const {promisify} = require('util')

const readFile = promisify(fs.readFile)

function document(template, data, options) {
  const html = template(data)
  return new Promise((resolve, reject) => {
    pdf
      .create(html, options)
      .toStream((err, stream) => {
        if (err) {
          return reject(err)
        }
        resolve(stream)
      })
  })
}

function getPrinter(id) {
  const intId = parseInt(id)
  const list = printer.getPrinters()

  if (isNumber(intId)) {
    const exists = typeof list[intId] !== 'undefined'
    if (!exists) {
      return false
    }
    return list[intId]
  }

  const p = printer.getPrinter(id)
  if (!p) {
    return false
  }

  return p
}

async function getTemplate(dir, name) {
  const base = path.resolve(dir, name)
  const file = path.resolve(base, 'template.hbs')
  const options = path.resolve(base, 'options.json')
  const fileStr = await readFile(file, 'utf8')
  const optsStr = await readFile(options, 'utf8')
  return {
    template: Handlebars.compile(fileStr),
    options: JSON.parse(optsStr)
  }
}

function print(document, id, options) {
  return new Promise((resolve, reject) => {
    const buffer = []
    document.on('data', d => buffer.push(d))
    document.on('end', () => {
      const data = Buffer.concat(buffer)
      const params = {
        data: data,
        docname: 'plastic-print',
        printer: getPrinter(id).name,
        type: 'RAW',
        success: (jobId) => resolve(jobId),
        error: (err) => reject(err)
      }
      printer.printDirect(params)
    })
  })

}

module.exports = Object.freeze({
  document,
  getPrinter,
  getPrinters: printer.getPrinters,
  getTemplate,
  print
})
