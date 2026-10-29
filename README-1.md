# SettingsArranger

BetterDiscord plugin that lets you move entries of the settings sidebar into a different section and change their order.

This used to be possible with CSS, but since Discord rebuilt the settings menu the sidebar is generated from a layout tree, so the plugin changes that tree instead.

## Install

Drop `SettingsArranger.plugin.js` into your BetterDiscord plugins folder and enable it.

## Usage

Open the plugin settings. Every section is listed with its entries:

- **Up / Down** changes the position inside the section.
- The dropdown moves the entry into another section.
- **Reset everything** restores Discord's default layout.

Changes show up the next time you open the Discord settings. A section that ends up with no entries is hidden.
