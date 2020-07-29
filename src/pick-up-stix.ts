/**
 * This is your TypeScript entry file for Foundry VTT.
 * Register custom settings, sheets, and constants using the Foundry API.
 * Change this heading to be more descriptive to your module, or remove it.
 * Author: [your name]
 * Content License: [copyright and-or license] If using an existing system
 * 					you may want to put a (link to a) license or copyright
 * 					notice here (e.g. the OGL).
 * Software License: [your license] Put your desired license here, which
 * 					 determines how others may use and modify your module
 */

// Import TypeScript modules
import { registerSettings } from './module/settings.js';
import { preloadTemplates } from './module/preloadTemplates.js';

let socket: any;
export type ItemData = {
	id?: string;
	data: any;
	count: number;
};

export enum SocketMessageType {
	deleteToken,
	updateToken,
	updateActor,
	createOwnedEntity,
	createItemToken
}

export interface PickUpStixSocketMessage {
	// user ID of the sender
	sender: string;
	type: SocketMessageType;
	data: any;
}

export interface PickUpStixFlags {
	itemData?: ItemData[];
	isContainer?: boolean;
	imageContainerClosedPath?: string;
	imageContainerOpenPath?: string;
	isOpen?: boolean;
	canClose?: boolean;
	currency?: {
		pp?: number;
		gp?: number;
		ep?: number;
		sp?: number;
		cp?: number;
	};
	isLocked?: boolean;
}

/**
 * Application class to display to select an item that the token is
 * associated with
 */
class ItemSheetApplication extends Application {
	static get defaultOptions(): ApplicationOptions {
	  const options = super.defaultOptions;
    options.id = "pick-up-stix-selectItem";
	  options.template = "modules/pick-up-stix/templates/item-sheet.html";
		options.width = 500;
		options.height = 'auto';
		options.minimizable = false;
		options.title = "Select an Item";
		options.resizable = true;
    return options;
	}

	private _flags: PickUpStixFlags = {
		currency: {
			pp: 0,
			gp: 0,
			ep: 0,
			sp: 0,
			cp: 0
		},
		itemData: [],
		canClose: true
	};

	private get isContainer(): boolean {
		return this._flags.isContainer;
	}
	private set isContainer(value: boolean) {
		this._flags.isContainer = value;
	}

	private get imageContainerOpenPath(): string {
		return this._flags.imageContainerOpenPath;
	}
	private set imageContainerOpenPath(value: string) {
		this._flags.imageContainerOpenPath = value;
	}

	private get imageContainerClosedPath(): string {
		return this._flags.imageContainerClosedPath;
	}
	private set imageContainerClosedPath(value: string) {
		this._flags.imageContainerClosedPath = value;
	}

	private get selectionData(): ItemData[] {
		return this._flags.itemData;
	}
	private set selectionData(value: ItemData[]) {
		this._flags.itemData = [
			...value
		];
	}

	private get currency(): any {
		return this._flags.currency;
	}
	private set currency(value: any) {
		this._flags.currency = {
			...value
		};
	}

	private _html: any;

	constructor(private _token: Token) {
		super({});
		console.log(`pick-up-stix | select item form | constructed with args:`)
		console.log(this._token);

		const itemFlags = this._token.getFlag('pick-up-stix', 'pick-up-stix');
		this._flags = {
			...this._flags,
			...duplicate(itemFlags ?? {})
		}

		console.log(`pick-up-stix | select item form | constructed with flags`);
		console.log(this._flags);
	}

	private async setSelectionAmount(id: string, count: number): Promise<ItemData> {
		let currItemData = this.selectionData.find(itemData => itemData.id === id);

		if (currItemData) {
			currItemData.count = count;
			console.log(`Previous value existed, setting ${currItemData.id} to count ${currItemData.count}`);
		}
		else {
			currItemData = {
				id,
				count: 1,
				data: {
					...this.getData()?.object?.items?.find((i: Item) => i._id === id)
				}
			};
			this.selectionData.push(currItemData);
			console.log(`Adding item ${currItemData.id} with count ${currItemData.count}`);
		}

		return currItemData;
	}

	activateListeners(html) {
		console.log(`pick-up-stix | SelectItemApplication | activateListeners called with args:`);
		console.log(html);

		super.activateListeners(this._html);
		this._html = html;

		Object.keys(this._flags.currency).forEach(k => {
			$(this._html).find(`.currency-wrapper [data-currency-type="${k}"]`).val(this._flags.currency[k]);
		});

		if (this.isContainer) {
			$(this._html).find(`#isContainerCheckBox`).prop('checked', true);
		}

		if (this._flags.canClose) {
			$(this._html).find(`#canCloseCheckBox`).prop('checked', true);
		}

		this.selectionData?.forEach(itemData => {
			console.log(`pick-up-stix | selection from setup | setting item ${itemData.data._id} to active and count to ${itemData.count}`);
			const item = $(this._html).find(`[data-item-id="${itemData.data._id}"]`);
			if (itemData.count > 0) {
				item.addClass('active');
			}
			item.find('.count').val(itemData.count);
		});

		/**
		 * Listen on the file input for when it's clicked. prevent the default dialog from
		 * opening and open the Foundry FilePicker
		 */
		$(this._html).find('input[type="file"]').click(e => {
			e.preventDefault();

			const openDialog = $(e.currentTarget).hasClass('open');

			const fp = new FilePicker({
				type: 'image',
				callback: path => {
					console.log(`pick-up-stix | file picker picked | setting container image ${openDialog ? 'open' : 'closed'} path to ${path}`);

					if (openDialog) {
						this.imageContainerOpenPath = path;
					}
					else {
						this.imageContainerClosedPath = path;
					}

					this.render();
				}
			}).browse((openDialog ? this.imageContainerOpenPath : this.imageContainerClosedPath) ?? '');
		});

		/**
		 * Listen for the container checkbox change event
		 */
		$(this._html).find('#isContainerCheckBox').change(async (e) => {
			console.log(`pick-up-stix | select form | file input check box changed`);
			this.isContainer = !this.isContainer;
			this.render();
		});

		if (this.isContainer) {
			/**
			 * Listen for if the can close checkbox is changed
			 */
			$(this._html).find('#canCloseCheckBox').change(async (e) => {
				console.log(`pick-up-stix | SelectItemApplication | canCloseCheckBox changed`);
				this._flags.canClose = !this._flags.canClose;
			});
		}

		/**
		 * Listen for the change event on the count input
		 */
		$(this._html).find('.item .count').change(async (e) => {
			const count = +$(e.currentTarget).val();
			const id = $(e.currentTarget).parent().attr('data-item-id');
			console.log(`pick-up-stix | selection from count input changed | Setting item ${id} to count ${count}`);
			if (count === 0) {
				$(this._html).find(`[data-item-id="${id}"]`).removeClass('active');
			}
			else if(count > 0) {
				$(this._html).find(`[data-item-id="${id}"]`).addClass('active');
			}
			await this.setSelectionAmount(id, count);
		});

		/**
		 * listen for currency input changes
		 */
		$(this._html).find('.currency-wrapper .currency-input').change(e => {
			console.log(`pick-up-stix | select item form | currency input changed with args:`)
			console.log(e);
			const currency = $(e.currentTarget).attr('data-currency-type');
			const amount = $(e.currentTarget).val();
			console.log(this._flags);
			this._flags.currency[currency] = amount;
			console.log(this._flags.currency);
		});

		/**
		 * Listen for clicks on each item's image and increment the item's count by one
		 */
		$(this._html).find('.item img').click(async (e) => {
			const item = $(e.currentTarget).parent();
			const itemId = item.attr('data-item-id');

			let currItemData = this.selectionData.find(itemData => itemData.id === itemId);
			currItemData = await this.setSelectionAmount(itemId, currItemData ? currItemData.count + 1 : 1);
			item.find('.count').val(currItemData[1]);
			console.log(`pick-up-stix | selection form image clicked | setting item ${itemId} to count ${currItemData.count}`);
			item.addClass('active');
			this.render();
		});
	}

	getData(): {options: any, object: { items: any[], isContainer: boolean, imageContainerOpenPath: string, imageContainerClosedPath: string, actor: Actor } } {
		return {
			options: this.options,
			object: {
				actor: this._token.actor,
				items: duplicate(game.items.entities.filter(i => !['class', 'spell', 'feat'].includes(i.type))),
				isContainer: this.isContainer,
				imageContainerOpenPath: this.imageContainerOpenPath,
				imageContainerClosedPath: this.imageContainerClosedPath
			}
		}
	}

	async close() {
		const flags: PickUpStixFlags = {
			...this._flags
		}

		const update = {
			img: flags.isOpen ? flags.imageContainerOpenPath : flags.imageContainerClosedPath,
			flags: {
				'pick-up-stix': {
					'pick-up-stix': {
						...flags
					}
				}
			}
		}
		await this._token.update(update);
		super.close();
	}
}

/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', async function() {
	console.log('pick-up-stix | init Hook');

	CONFIG.debug.hooks = true;

	// Assign custom classes and constants here

	// Register custom module settings
	registerSettings();

	// Preload Handlebars templates
	await preloadTemplates();

	// Register custom sheets (if any)
});

/* ------------------------------------ */
/* When ready													  */
/* ------------------------------------ */
Hooks.once('ready', function() {
	// Do anything once the module is ready
	console.log(`pick-up-stix | ready hook`);

	canvas?.tokens?.placeables?.forEach(async (p: PlaceableObject) => {
		const data: PickUpStixFlags = p.getFlag('pick-up-stix', 'pick-up-stix');

		if (data) {
			console.log(`pick-up-stix | ready hook | found token ${p.id} with itemData`);
			p.mouseInteractionManager = setupMouseManager.bind(p)();
		}
	});

	socket = game.socket;

	socket.on('module.pick-up-stix', async (msg: PickUpStixSocketMessage) => {
		console.log(`pick-up-stix | socket.on | received socket message with args:`);
		console.log(msg);

		if (msg.sender === game.user.id) {
			console.log(`pick-up-stix | receieved socket message | i sent this, ignoring`);
			return;
		}

		const firstGm = game.users.find((u) => u.isGM && u.active);
		if (firstGm && game.user !== firstGm) {
   		return;
		}

		let actor;
		let token;

		switch (msg.type) {
			case SocketMessageType.updateActor:
				actor = game.actors.get(msg.data.actorId);
				await actor.update(msg.data.updates);
				break;
			case SocketMessageType.deleteToken:
				await canvas.scene.deleteEmbeddedEntity('Token', msg.data);
				break;
			case SocketMessageType.updateToken:
				token = canvas.tokens.get(msg.data.tokenId);
				await token.update(msg.data.updates);
				break;
			case SocketMessageType.createOwnedEntity:
				actor = game.actors.get(msg.data.actorId);
				await actor.createOwnedItem(msg.data.items);
				break;
			case SocketMessageType.createItemToken:
				await Token.create(msg.data);
				break;
		}
	});
});

Hooks.on('canvasReady', (...args) => {
	console.log(`pick-up-stix | canvasReady hook | call width args:`);
	console.log(args);

	const coreVersion: string = game.data.version;
	if (isNewerVersion(coreVersion, '0.6.5')) {
		console.log(`pick-up-stix | canvasReady hook | Foundry version newer than 0.6.5. Using dropCanvasData hook`);
		Hooks.on('dropCanvasData', async (canvas, dropData) => {
			console.log(`pick-up-stix | dropCanvasData | called with args:`);
			console.log(canvas, dropData);

			if (dropData.type === "Item") {
				handleDropItem(dropData);
			}
		});
	}
	else {
		console.log(`pick-up-stix | canvasReady hook | Foundry version is 0.6.5 or below. Overriding Canvas._onDrop`);
		canvas._dragDrop = new DragDrop({ callbacks: { drop: handleOnDrop.bind(canvas) } }).bind(document.getElementById('board'));
	}
})

Hooks.on('preCreateOwnedItem', async (actor: Actor, itemData: any, options: any, userId: string) => {
	let owner: { actorId: string, itemId: string };
	if (owner = getProperty(itemData.flags, 'pick-up-stix.pick-up-stix.owner')) {
		setProperty(itemData.flags, 'pick-up-stix.pick-up-stix.owner', { actorId: actor.id });
		const ownerActor = game.actors.get(owner.actorId);
		await ownerActor.deleteOwnedItem(itemData._id);
	}
	else {
		setProperty(itemData.flags, 'pick-up-stix.pick-up-stix.owner', { actorId: actor.id });
	}
});

Hooks.on('renderTokenHUD', (hud: TokenHUD, hudHtml: JQuery, data: any) => {
  if (!data.isGM) {
		console.log(`pick-up-stix | renderTokenHUD hook | user is not a gm, don't change HUD`);
		return;
	}

	if (data.actorId && !game.modules.get('lootsheetnpc5e').active) {
		console.log(`pick-up-stix | renderTokenHUD hook | token has an actor associated with it, dont' change HUD`);
		return;
	}

	console.log(`pick-up-stix | renderTokenHUD hook | called with args:`);
	console.log(hud, hudHtml, data);

	const flags = getProperty(data.flags, 'pick-up-stix.pick-up-stix');

	const containerDiv = document.createElement('div');
	containerDiv.style.display = 'flex';
	containerDiv.style.flexDirection = 'row';

	// create the control icon div and add it to the container div
	const controlIconDiv = document.createElement('div');
	controlIconDiv.className = 'control-icon';
	const controlIconImg = document.createElement('img');
	controlIconImg.src = flags?.['itemData']?.length
		? 'modules/pick-up-stix/assets/pick-up-stix-icon-white.svg'
		: 'modules/pick-up-stix/assets/pick-up-stix-icon-black.svg';
	controlIconImg.className = "item-pick-up";
	controlIconDiv.appendChild(controlIconImg);
	controlIconDiv.addEventListener('mousedown', displayItemContainerApplication(hud, controlIconImg, data));
	containerDiv.appendChild(controlIconDiv);

	// if the item is a container then add the lock icon
	if (flags?.isContainer) {
		const lockDiv = document.createElement('div');
		lockDiv.style.marginRight = '10px';
		lockDiv.className = 'control-icon';
		const lockImg = document.createElement('img');
		lockImg.src = flags?.['isLocked']
			? 'modules/pick-up-stix/assets/lock-white.svg'
			: 'modules/pick-up-stix/assets/lock-black.svg';
		lockDiv.appendChild(lockImg);
		lockDiv.addEventListener('mousedown', toggleLocked(data));
		containerDiv.prepend(lockDiv);
	}

	// add the container to the hud
	$(hudHtml.children('div')[0]).prepend(containerDiv);
});

function toggleLocked(data): () => void {
	return async () => {
		const token = canvas.tokens.get(data._id);
		const isLocked = token.getFlag('pick-up-stix', 'pick-up-stix.isLocked');
		await token.setFlag('pick-up-stix', 'pick-up-stix.isLocked', !isLocked);
	}
}

Hooks.on('updateToken', (scene: Scene, tokenData: any, tokenFlags: any, userId: string) => {
	console.log(`pick-up-stix | updateToken`)
	const token: Token = canvas?.tokens?.placeables?.find((p: PlaceableObject) => p.id === tokenData._id);

	const flags = token.getFlag('pick-up-stix', 'pick-up-stix');
	if (flags) {
			token.mouseInteractionManager = setupMouseManager.bind(token)();
			token.activateListeners = setupMouseManager.bind(token);
	}
});

Hooks.on('createToken', async (scene: Scene, tokenData: any, options: any, userId: string) => {
	console.log(`pick-up-stix | createToken hook`);
	const token: Token = canvas?.tokens?.placeables?.find((p: PlaceableObject) => p.id === tokenData._id);

	const flags = token.getFlag('pick-up-stix', 'pick-up-stix');
	if (flags) {
			token.mouseInteractionManager = setupMouseManager.bind(token)();
			token.activateListeners = setupMouseManager.bind(token);
	}
});

function displayItemContainerApplication(hud: TokenHUD, img: HTMLImageElement, tokenData: any): (this: HTMLDivElement, ev: MouseEvent) => any {
	return async function(this, ev: MouseEvent) {
		console.log(`pick-up-sticks | toggle icon clicked`);
		const token: Token = canvas?.tokens?.placeables?.find((p: PlaceableObject) => p.id === tokenData._id);
		if (!token) {
			console.log(`pick-up-stix | displayItemContainerApplication | Couldn't find token '${tokenData._id}'`);
			return;
		}

		new ItemSheetApplication(token).render(true);
	}
}

function setupMouseManager(): void {
	console.log(`pick-up-stix | setupMouseManager`);

	const permissions = {
		clickLeft: () => true,
		clickLeft2: this._canView,
		clickRight: this._canHUD,
		clickRight2: this._canConfigure,
		dragStart: this._canDrag
	};

	// Define callback functions for each workflow step
	const callbacks = {
		clickLeft: handleTokenItemClicked,
		clickLeft2: this._onClickLeft2,
		clickRight: this._onClickRight,
		clickRight2: this._onClickRight2,
		dragLeftStart: this._onDragLeftStart,
		dragLeftMove: this._onDragLeftMove,
		dragLeftDrop: this._onDragLeftDrop,
		dragLeftCancel: this._onDragLeftCancel,
		dragRightStart: null,
		dragRightMove: null,
		dragRightDrop: null,
		dragRightCancel: null
	};

	// Define options
	const options = {
		target: this.controlIcon ? "controlIcon" : null
	};

	// Create the interaction manager
	this.mouseInteractionManager = new MouseInteractionManager(this, canvas.stage, permissions, callbacks, options).activate();
}

async function handleTokenItemClicked(e): Promise<void> {
	console.log(`pick-up-stix | handleTokenItemClicked | ${this.id}`);

	// if the token is hidden just do a normal click
	if (e.currentTarget.data.hidden) {
		console.log(`pick-up-stix | handleTokenItemClicked | token is hidden, handle normal click`);
		this._onClickLeft(e);
		return;
	}

	// get the tokens that the user controls
	const controlledTokens = canvas.tokens.controlled;

	// get the flags on the clicked token
	const flags: PickUpStixFlags = duplicate(this.getFlag('pick-up-stix', 'pick-up-stix'));

	// gm special stuff
	if (game.user.isGM) {
		if (!controlledTokens.length) {
			console.log(`pick-up-stix | handleTokenItemClicked | no controlled tokens, handle normal click`);
			this._onClickLeft(e);
			return;
		}

		const controlledFlags = controlledTokens[0].getFlag('pick-up-stix', 'pick-up-stix')

		// if there is only one controlled token and it's the item itself, don't do anything
		if (controlledTokens.length === 1 && (controlledTokens.includes(this) || controlledFlags)) {
			console.log(`pick-up-stix | handleTokenItemClicked | only controlling the item, handle normal click`);
			this._onClickLeft(e);
			return;
		}
	}

	if (controlledTokens.length !== 1 || controlledTokens[0]?.getFlag('pick-up-stix', 'pick-up-stix.itemData')?.length > 0) {
		ui.notifications.error('You must be controlling only one token to pick up an item');
		return;
	}

	// get the token the user is controlling
	const userControlledToken: Token = controlledTokens[0];

	// if the item isn't visible can't pick it up
	if (!this.isVisible) {
		console.log(`pick-up-stix | handleTokenItemClicked | item is not visible to user`);
		return;
	}

	// get the distance to the token and if it's too far then can't pick it up
	const dist = Math.hypot(userControlledToken.x - this.x, userControlledToken.y - this.y);
	const maxDist = Math.hypot(canvas.grid.size, canvas.grid.size);
	if (dist > maxDist) {
		console.log(`pick-up-stix | handleTokenItemClicked | item is out of reach`);
		return;
	}

	const isLocked = flags.isLocked;

	// if it's locked then it can't be opened
	if (isLocked) {
		console.log(`pick-up-stix | handleTokenItemClicked | item is locked, play lock sound`);
		var audio = new Audio('sounds/lock.wav');
		audio.play();
		return;
	}

	// if it's a container and it's open and can't be closed then don't do anything
	if (flags.isContainer && flags.isOpen && !flags.canClose) {
		console.log(`pick-up-stix | handleTokenItemClicked | container is open and can't be closed`);
		return;
	}

	let containerUpdates;

	// create an update for the container but don't run update it yet. if it's container then switch then
	// open property
	if(flags.isContainer) {
		console.log(`pick-up-stix | handleTokenItemClicked | item is a container`);
		flags.isOpen = !flags.isOpen;

		containerUpdates = {
			img: flags.isOpen ? flags.imageContainerOpenPath : flags.imageContainerClosedPath,
			flags: {
				'pick-up-stix': {
					'pick-up-stix': {
						...flags
					}
				}
			}
		};

		// if there are any container updates then update the container
		if (containerUpdates) {
			await new Promise(resolve => {
				setTimeout(() => {
					updateToken(this, containerUpdates);
					resolve();
				}, 200);
			});
		}

		if (this.actor && game.modules.get('lootsheetnpc5e').active && flags.isOpen) {
			this._onClickLeft2(e);
			return;
		}
	}

	// if it's not a container or if it is and it's open it's now open (from switching above) then update
	// the actor's currencies if there are any in the container
	if (!flags.isContainer || flags.isOpen) {
		let currencyFound = false;
		let chatContent = '';
		const userCurrencies = userControlledToken?.actor?.data?.data?.currency;
		const actorUpdates = Object.keys(flags?.currency || {})?.reduce((acc, next) => {
			if (flags?.currency?.[next] > 0) {
				currencyFound = true;
				chatContent += `<span class="pick-up-stix-chat-currency ${next}"></span><span>(${next}) ${flags?.currency?.[next]}</span><br />`;
				userCurrencies[next] = userCurrencies[next] ? +userCurrencies[next] + +flags.currency?.[next] : flags.currency?.[next];
			}
			return userCurrencies;
		}, userCurrencies);

		if (currencyFound) {
			let content = `<p>Picked up:</p>${chatContent}`;
			ChatMessage.create({
				content,
				speaker: {
					alias: userControlledToken.actor.name,
					scene: (game.scenes as any).active.id,
					actor: userControlledToken.actor.id,
					token: userControlledToken.id
				}
			});
			await updateActor(userControlledToken.actor, { data: { data: { currency: { ...userCurrencies }}}});
		}
	}

	// get the items from teh container and create an update object if there are any
	if (!flags.isContainer || flags.isOpen) {
		const itemsToCreate = [];

		for (let i=0; i < flags.itemData.length; i++) {
			const itemData = flags.itemData[i];
			const datas = [];
			for (let i = 0; i < itemData.count; i++) {
				datas.push({
					...itemData.data
				});
			}

			itemsToCreate.push(...datas)

			if (itemData.count > 0) {
				ChatMessage.create({
					content: `
						<p>Picked up ${itemData.count} ${itemData.data.name}</p>
						<img src="${itemData.data.img}" style="width: 40px;" />
					`,
					speaker: {
						alias: userControlledToken.actor.name,
						scene: (game.scenes as any).active.id,
						actor: userControlledToken.actor.id,
						token: userControlledToken.id
					}
				});
			}
		}

		// if it's a container, clear out the items as they've been picked up now
		if (flags.isContainer) {
			containerUpdates.flags['pick-up-stix']['pick-up-stix'].itemData = [];
			containerUpdates.flags['pick-up-stix']['pick-up-stix'].currency = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
		}

		await createOwnedEntity(userControlledToken.actor, itemsToCreate);
	}

	if (!flags.isContainer) {
		await deleteToken(this);
	}

	this.mouseInteractionManager?._deactivateDragEvents();
}

async function deleteToken(token: Token): Promise<void> {
	console.log(`pick-up-stix | deleteToken with args:`);
	console.log(token);

	if (game.user.isGM) {
		await canvas.scene.deleteEmbeddedEntity('Token', token.id);
		return;
	}

	const msg: PickUpStixSocketMessage = {
		sender: game.user.id,
		type: SocketMessageType.deleteToken,
		data: token.id
	}
	socket.emit('module.pick-up-stix', msg);
}

async function updateToken(token: Token, updates): Promise<void> {
	console.log(`pick-up-stix | updateToken with args:`);
	console.log(token, updates);

	if (game.user.isGM) {
		await token.update(updates);
		return;
	}

	const msg: PickUpStixSocketMessage = {
		sender: game.user.id,
		type: SocketMessageType.updateToken,
		data: {
			tokenId: token.id,
			updates
		}
	};

	socket.emit('module.pick-up-stix', msg);
}

async function updateActor(actor, updates): Promise<void> {
	if (game.user.isGM) {
		await actor.update(updates);
		return;
	}

	const msg: PickUpStixSocketMessage = {
		sender: game.user.id,
		type: SocketMessageType.updateActor,
		data: {
			actorId: actor.id,
			updates
		}
	};

	socket.emit('module.pick-up-stix', msg);
}

async function createOwnedEntity(actor: Actor, items: any[]) {
	if (game.user.isGM) {
		await actor.createEmbeddedEntity('OwnedItem', items);
		return;
	}

	const msg: PickUpStixSocketMessage = {
		sender: game.user.id,
		type: SocketMessageType.createOwnedEntity,
		data: {
			actorId: actor.id,
			items
		}
	};

	socket.emit('module.pick-up-stix', msg);
}

async function createItemToken(data: any) {
	console.log(`pick-up-stix | createItemToken | called with args:`);
	console.log(data);
	if (game.user.isGM) {
		console.log(`pick-up-stix | createItemToken | current user is GM, creating token`);
		await Token.create({
			...data
		});
		return;
	}

	console.log(`pick-up-stix | createItemToken | current user is not GM, send socket message`);
	const msg: PickUpStixSocketMessage = {
		sender: game.user.id,
		type: SocketMessageType.createItemToken,
		data
	}
	socket.emit('module.pick-up-stix', msg);
}

/**
 * @override
 *
 * @param event
 */
async function handleOnDrop(event) {
	console.log(`pick-up-stix | handleOnDrop | called with args:`);
	console.log(event);
	event.preventDefault();

	// Try to extract the data
	let data;
	try {
		data = JSON.parse(event.dataTransfer.getData('text/plain'));
	}
	catch (err) {
		return false;
	}

	// Acquire the cursor position transformed to Canvas coordinates
	const [x, y] = [event.clientX, event.clientY];
	const t = this.stage.worldTransform;
	data.x = (x - t.tx) / canvas.stage.scale.x;
	data.y = (y - t.ty) / canvas.stage.scale.y;

	// Dropped Actor
	if ( data.type === "Actor" ) canvas.tokens._onDropActorData(event, data);

	// Dropped Journal Entry
	else if ( data.type === "JournalEntry" ) canvas.notes._onDropData(event, data);

	// Dropped Macro (clear slot)
	else if ( data.type === "Macro" ) {
		game.user.assignHotbarMacro(null, data.slot);
	}

	// Dropped Tile artwork
	else if ( data.type === "Tile" ) {
		return canvas.tiles._onDropTileData(event, data);
	}
	// Dropped Item
	else if (data.type === "Item") {
		handleDropItem(data);
	}
}

async function handleDropItem(dropData) {
	console.log(`pick-up-stix | handleDropItem | called with args:`);
	console.log(dropData);

	// if the item came from an actor's inventory, then it'll have an actorId property, we'll need to remove the item from that actor
	const sourceActorId: string = dropData.actorId;

	let pack: string;
	let itemId: string;
	let itemData: any;

	// if the item comes from an actor's inventory, then the data structure is a tad different, the item data is stored
	// in a data property on the dropData parameter rather than on the top-level of the dropData
	if (sourceActorId) {
		console.log(`pick-up-stix | handleDropItem | actor '${sourceActorId}' dropped item`);
		itemData = {
			...dropData.data
		};
	}
	else {
		console.log(`pick-up-stix | handleDropItem | item comes from directory or compendium`);
		pack = dropData.pack;
		itemId = dropData.id;
		const item: Item = await game.packs.get(pack)?.getEntity(itemId) ?? game.items.get(itemId);
		if (!item) {
			console.log(`pick-up-stix | handleDropItem | item '${dropData.id}' not found in game items or compendium`);
			return;
		}
		itemData = {
			...item.data
		}
	}

	if (sourceActorId) {
		await game.actors.get(sourceActorId).deleteOwnedItem(dropData.data._id);
	}

	let targetToken: Token;
	let p: PlaceableObject;
	for (p of canvas.tokens.placeables) {
		if (dropData.x < p.x + p.width && dropData.x > p.x && dropData.y < p.y + p.height && dropData.y > p.y && p instanceof Token && p.actor) {
			targetToken = p;
			break;
		}
	}

	if (targetToken) {
		console.log(`pick-up-stix | handleDropItem | item dropped onto target token '${targetToken.id}'`);
		await createOwnedEntity(targetToken.actor, [{
			...itemData
		}]);
	}
	else {
		const hg = canvas.dimensions.size / 2;
		dropData.x -= (hg);
		dropData.y -= (hg);

		const { x, y } = canvas.grid.getSnappedPosition(dropData.x, dropData.y, 1);
		dropData.x = x;
		dropData.y = y;

		await createItemToken({
			img: itemData.img,
			name: itemData.name,
			x: dropData.x,
			y: dropData.y,
			disposition: 0,
			flags: {
				'pick-up-stix': {
					'pick-up-stix': {
						originalImagePath: itemData.img,
						itemData: [
							{ count: 1, data: { ...itemData } }
						]
					}
				}
			}
		});
	}
}
