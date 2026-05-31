import { AC, AE, Input }	from './DomUtils.js'

export default class
FetchProgression extends HTMLElement {

	static get observedAttributes() {
		return [ 'value' ]
	}

	constructor() {
		super()

		this.URL					= AC( this, Input( this.getAttribute( 'value' ) ) )
		AE( this, 'br' )
		this.PROGRESS				= AE( this, 'progress' )
		this.PROGRESS.value			= 0

		this.URL.style.width		= '100%'
		this.PROGRESS.style.width	= '100%'
	}
	get value() {
		return this.URL.value
	}
	set value( _ ) {
		this.URL.value = _
	}

	attributeChangedCallback( name, _, newVal ) {
		name === 'value' && ( this.value = newVal )
	}

	Fetch() {
		return fetch( this.value ).then(
			S => (
				this.PROGRESS.max = S.headers.get( 'content-length' )
			,	S.body.getReader()
			)
		).then(
			async reader => {
				const	chunks = []
				let		offset = 0
				while ( true ) {
					const
					{ done, value } = await reader.read()
					if	( done ) break
					chunks.push( value )
					offset += value.length
					this.PROGRESS.max && ( this.PROGRESS.value = offset )
				}
				const
				$ = new Uint8Array( offset )
				offset = 0
				for ( const _ of chunks ) {
					$.set( _, offset )
					offset += _.length
				}
				return $
			}
		)
	}
}
customElements.define( 'fetch-progression', FetchProgression )
