// The one switch for dev mode (dev.js: the Dev Mode menu entry and the dev panel).
// true  -> the main menu gets a "Dev Mode" button and F2 opens the panel once you are in it.
// false -> dev.js is never fetched and nothing of dev mode exists in the page. Set this to false for anything you hand to other people.
// To remove dev mode for good: delete dev-flag.js and dev.js, and delete the `DEV_MODE` import and the `if(DEV_MODE){...}` block at the end of game.js.
export const DEV_MODE=true;
