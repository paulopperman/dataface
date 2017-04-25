const html = require('choo/html')
const css = require('sheetify')
const keyboard = require('keyboardjs')
const HyperList = require('hyperlist-component')
const offset = require('mouse-event-offset')
const onload = require('on-load')

const setCursor = require('../util').setCursor
const contextMenu = require('../components/context-menu.js')
const prefix = css('./grid.css')

const opts = {
  height: 500,
  itemHeight: 34,
  eachItem: tableRow,
  getTotal: (state) => state.rows.length
}
const hyperList = new HyperList('tbody', opts)

module.exports = function grid (state, emit) {
  const { fields, rows } = state.store.activeSheet
  const selectedCell = Object.assign({}, state.ui.selectedCell)

  const moveCellUp = moveCell.bind(this, 'up')
  const moveCellDown = moveCell.bind(this, 'down')
  const moveCellLeft = moveCell.bind(this, 'left')
  const moveCellRight = moveCell.bind(this, 'right')
  const noop = () => {}

  const tbody = hyperList.render({ fields, rows, selectedCell })
  tbody.addEventListener('blur', onBlurCell, true)

  return html`
    <div class=${prefix} onload=${onLoad} onunload=${onUnload}>
      <table class="table is-bordered is-striped is-narrow"
        onclick=${onClickCell} ondblclick=${onDblClickCell}>
        <thead oncontextmenu=${onHeaderMenu}>
          <tr>${fields.map(tableHeader)}</tr>
        </thead>
        ${tbody}
      </table>
      ${headerMenu(state.ui.headerMenu)}
    </div>
  `

  function headerMenu (headerMenuState) {
    const items = [
      { label: 'Set type', onclick: () => console.log('Clicked "set type"') },
      { label: 'Remove column', onclick: () => console.log('Clicked "remove column"') }
    ]
    return headerMenuState.visible
      ? contextMenu(items, headerMenuState, hideHeaderMenu)
      : ''
  }

  function onHeaderMenu (evt) {
    const parentEl = evt.target.parentNode
    const [x, y] = offset(evt, parentEl)
    emit('ui:headerMenu', { x, y, visible: true })
    evt.preventDefault()
  }

  function hideHeaderMenu () {
    emit('ui:headerMenu', { visible: false })
  }

  function onClickCell (evt) {
    const el = evt.target
    const rowIndex = +el.dataset.rowIndex
    const columnIndex = +el.dataset.columnIndex
    const isSelected = el.classList.contains('selected')

    if (!isSelected) {
      const payload = { rowIndex, columnIndex, editing: false }
      emit('ui:selectCell', payload)
    }
  }

  function onDblClickCell (evt) {
    const el = evt.target
    const rowIndex = +el.dataset.rowIndex
    const columnIndex = +el.dataset.columnIndex
    const isEditing = el.classList.contains('editing')
    if (!isEditing) {
      const payload = { rowIndex, columnIndex, editing: true }
      emit('ui:selectCell', payload)
    }
  }

  function onBlurCell (evt) {
    const { rowIndex, columnIndex, editing } = state.ui.selectedCell
    const value = evt.target.innerText
    save(rowIndex, columnIndex, value)
    if (editing) { // will be false if user hit enter b/c of enter listener
      emit('ui:selectCell', {editing: false})
    }
  }

  function onLoad (el) {
    keyboard.bind('up', moveCellUp)
    keyboard.bind('down', moveCellDown)
    keyboard.bind('left', moveCellLeft)
    keyboard.bind('right', moveCellRight)
    keyboard.bind('tab', moveCellRight)
    keyboard.bind('shift + tab', moveCellLeft)
    keyboard.bind('shift + enter', noop) // differentiate from just enter
    keyboard.bind('enter', enter)
  }

  function onUnload (el) {
    keyboard.unbind('up', moveCellUp)
    keyboard.unbind('down', moveCellDown)
    keyboard.unbind('left', moveCellLeft)
    keyboard.unbind('right', moveCellRight)
    keyboard.unbind('tab', moveCellRight)
    keyboard.unbind('shift + tab', moveCellLeft)
    keyboard.unbind('shift + enter', noop)
    keyboard.unbind('enter', enter)
  }

  function moveCell (direction, evt) {
    const { rowIndex, columnIndex, editing } = state.ui.selectedCell
    const payload = {}

    // Don't do anything if no cell is selected or editing
    if (rowIndex === null || editing) return

    switch (direction) {
      case 'up':
        const prevRowIndex = rowIndex - 1
        payload.rowIndex = Math.max(prevRowIndex, -1) // -1 is header
        break
      case 'down':
        const nextRowIndex = rowIndex + 1
        const lastRowIndex = rows.length - 1
        payload.rowIndex = Math.min(nextRowIndex, lastRowIndex)
        break
      case 'left':
        const prevColumnIndex = columnIndex - 1
        payload.columnIndex = Math.max(prevColumnIndex, 0)
        break
      case 'right':
        const nextColumnIndex = columnIndex + 1
        const lastColumnIndex = fields.length - 1
        payload.columnIndex = Math.min(nextColumnIndex, lastColumnIndex)
        break
    }
    emit('ui:selectCell', payload)
    evt.preventDefault()
  }

  function enter (evt) {
    const { rowIndex, editing } = state.ui.selectedCell

    // Don't do anything if no cell is selected
    if (rowIndex === null) return

    // Set editing to opposite of current state
    emit('ui:selectCell', {editing: !editing})
    evt.preventDefault()
  }

  function save (rowIndex, columnIndex, value) {
    const field = fields[columnIndex].name
    const oldValue = rows[rowIndex][field]
    if (value !== oldValue) {
      const updates = { [field]: value }
      emit('store:update', { rowIndex, updates })
    }
  }

  function tableHeader (field, columnIndex) {
    const selectedCell = state.ui.selectedCell
    const opts = {
      value: field.name,
      rowIndex: -1,
      columnIndex,
      isHeader: true,
      isSelected: (selectedCell.rowIndex === -1) &&
                  (selectedCell.columnIndex === columnIndex),
      isEditing: selectedCell.editing
    }
    return tableCell(opts)
  }
}

function tableRow (state, rowIndex) {
  const { fields, rows, selectedCell } = state
  const row = rows[rowIndex]

  return html`
    <tr>
      ${fields.map((field, columnIndex) => {
        const tableCellOpts = {
          value: row[field.name] || '',
          rowIndex,
          columnIndex,
          isHeader: false,
          isSelected: (rowIndex === selectedCell.rowIndex) &&
                      (columnIndex === selectedCell.columnIndex),
          isEditing: selectedCell.editing
        }
        return tableCell(tableCellOpts)
      })}
    </tr>
  `
}

function tableCell (opts) {
  const tagName = opts.isHeader ? 'th' : 'td'
  const el = document.createElement(tagName)
  el.innerText = opts.value

  el.dataset.rowIndex = opts.rowIndex
  el.dataset.columnIndex = opts.columnIndex

  if (opts.isSelected) {
    el.classList.add('selected')
  }

  if (opts.isSelected && opts.isEditing) {
    el.classList.add('editing')
    el.setAttribute('contenteditable', true)
    onload(el, setCursorInSelectedCell)
  }

  return el
}

function setCursorInSelectedCell () {
  // Can't use the `el` arg passed because of dom morphing.
  // It's probably a bug with nanomorph, technically
  const el = document.querySelector('.selected')
  setCursor(el)
}
