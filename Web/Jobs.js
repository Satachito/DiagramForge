export	const
dones	= []
export	const
todos	= []

//	Cap the undo history: each entry holds a full structuredClone of app
//	(embedded base64 SVG/PNG included), so an uncapped stack grows without bound.
const
LIMIT	= 100

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
	while	( dones.length > LIMIT ) dones.shift()
	todos.length = 0
}
