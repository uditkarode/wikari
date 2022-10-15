# Wikari

A Node JS library to control **Philips WiZ smart bulbs**, written in TypeScript.

Wikari is very strongly typed!

# Installation
```bash
$ npm i wikari
```

# API

The library is fairly simple to use, since you're mostly going to deal with `Bulb` objects:

```typescript
import { discover, SCENES } from "wikari";

const bulbs = await discover({});

const bulb = bulbs[0];

if (!bulb) return console.log("No bulbs found!");

// get the current state of the bulb
// WiZ calls the bulb state "pilot"
// so you have "setPilot" and "getPilot"
console.log(await bulb.getPilot());

// whenever the bulb sends a message, log it to the console
bulb.onMessage(console.log);

// turn the bulb on
await bulb.turn(true);

// set the color to red
await bulb.color("#f44336");

// set the color to some cool and some warm white
await bulb.color({ c: 40, w: 40 });

// set the scene to "TV Time"
await bulb.scene(SCENES["TV Time"]);

// set the bulb to 10_000K white
await bulb.white(10_000);

// set the bulb brightness to 40%
await bulb.brightness(40);

// toggle the bulb (turns it off since it was already on)
await bulb.toggle();

bulb.closeConnection();
```

# Subscription

It's possible to subscribe to updates from the bulb.

```typescript
await bulb.subscribe();

bulb.onSync(syncPilotMsg => {
	// syncPilotMsg is the updated state of the bulb
	// it sends a syncPilot message on state change.
	// so for example, if you change the state using
	// the WiZ app on your phone, the changes will
	// show up here as well.
});
```

# TSDoc

Most of the functions have TSDoc comments, so you can either hover over them and your IDE will display it,
or just skim through the library source code to find it.

# Advanced Usage

If you want complete control over the bulb, or want to mix and match various settings, you can try using the `setPilot` or `sendRaw` functions.
However, you should mostly find the functions in the example above to be enough.

---
### What's Wikari?
It's supposed to be WiZ + Hikari (光, "light" in Japanese)
