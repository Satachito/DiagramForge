import { AE } from './DomUtils.js'

import './shape-editor.js'
import './paint-editor.js'

export default class
NodeEditor extends HTMLElement {

	constructor() {
		super()

		this.SHAPE	= AE( this, 'shape-editor' )
		this.PAINT	= AE( this, 'paint-editor' )
	}

	get $() {
		return [ this.SHAPE.$, this.PAINT.$ ]	//	[ S, P ]
	}

	set $( [ S, P ] ) {
		this.SHAPE.$ = S
		this.PAINT.$ = P ?? {}
	}
}

customElements.define( 'node-editor', NodeEditor )
