const {CompositeDisposable, Point} = require('atom')

module.exports =
class BufferBinding {
  constructor (textBuffer) {
    this.textBuffer = textBuffer
    this.subscriptions = new CompositeDisposable()
    this.applyingRemoteChanges = false
    this.subscriptions.add(this.textBuffer.onDidChangeText(({changes}) => this.relayLocalChanges(changes)))
    this.pendingOperations = []
  }

  setSharedBuffer (sharedBuffer) {
    this.sharedBuffer = sharedBuffer
    if (this.pendingOperations.length > 0) {
      this.sharedBuffer.applyMany(this.pendingOperations)
      this.pendingOperations = null
    }
  }

  setText (text) {
    this.applyingRemoteChanges = true
    this.textBuffer.setText(text)
    this.applyingRemoteChanges = false
  }

  relayLocalChanges (changes) {
    if (this.applyingRemoteChanges) return

    const operations = []
    for (let i = 0; i < changes.length; i++) {
      const {oldRange, newRange, newText} = changes[i]
      if (!oldRange.isEmpty()) {
        operations.push({type: 'delete', position: newRange.start, extent: oldRange.getExtent()})
      }
      if (newText.length > 0) {
        operations.push({type: 'insert', position: newRange.start, text: newText})
      }
    }
    if (this.sharedBuffer) {
      this.sharedBuffer.applyMany(operations)
    } else {
      this.pendingOperations.push(...operations)
    }
  }

  applyMany (operations) {
    this.applyingRemoteChanges = true

    this.textBuffer.transact(() => {
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i]
        switch (op.type) {
          case 'insert':
            this.textBuffer.insert(op.position, op.text)
            break
          case 'delete':
            const end = Point.fromObject(op.position).traverse(op.extent)
            this.textBuffer.delete([op.position, end])
            break
          default:
            throw new Error('Unsupported operation type: ' + op.type)
        }
      }
    })

    this.applyingRemoteChanges = false
  }
}