console.log( 'Jobs.js' )

export	const
dones	= []
export	const
todos	= []

export	const
DumpJobs	= () => {
	console.log( '---- todos', todos.length )
	todos.forEach( _ => console.log( _.label ) )
	console.log( '---- dones', dones.length )
	dones.forEach( _ => console.log( _.label ) )
}

export	const
Undo	= async () => {
	if	( !dones.length ) return
	const
	_ = dones.pop()
	await _.undo()
	todos.push( _ )
}

export	const
Redo	= async () => {
	if	( !todos.length ) return
	const
	_ = todos.pop()
	await _.redo()
	dones.push( _ )
}

export	default
async ( label, redo, undo ) => {
	await redo()
	dones.push(
		{	label
		,	redo
		,	undo
		}
	)
	todos.length = 0
}
