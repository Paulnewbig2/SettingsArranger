/**
 * @name SettingsArranger
 * @author mendjdjje
 * @description Move any entry of the settings sidebar into another section and change its position.
 * @version 1.0.0
 * @source https://github.com/mendjdjje/SettingsArranger/
 */

const {Webpack, React, Components} = BdApi;
const {Patcher, Data, DOM} = new BdApi("SettingsArranger");
const {Button, DropdownInput, ErrorBoundary, Text} = Components;

const CSS = `
.sa-panel { display: flex; flex-direction: column; gap: 16px; }
.sa-section { display: flex; flex-direction: column; gap: 4px; }
.sa-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border-faint, rgba(128, 128, 128, 0.2)); }
.sa-row-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sa-row .bd-select { width: 180px; }
.sa-empty { opacity: 0.6; font-style: italic; }
`;

let config = {placement: {}, order: {}};
let root = null;
let snapshot = [];

function loadConfig() {
    const stored = Data.load("config") ?? {};
    config = {placement: stored.placement ?? {}, order: stored.order ?? {}};
}

function saveConfig() {
    Data.save("config", config);
}

function isCustomized() {
    return Object.keys(config.placement).length > 0 || Object.keys(config.order).length > 0;
}

function prettify(key) {
    if (key === "betterdiscord") return "BetterDiscord";
    return key
        .replace(/_(section|sidebar_item)$/, "")
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function readSections(layout) {
    return layout
        .filter(node => typeof node?.key === "string" && typeof node.buildLayout === "function")
        .map(section => ({section, items: section.buildLayout() ?? []}));
}

function arrange(groups) {
    const buckets = new Map(groups.map(({section}) => [section.key, []]));
    const moved = [];

    for (const {section, items} of groups) {
        for (const item of items) {
            const target = config.placement[item?.key];
            if (buckets.has(target) && target !== section.key) moved.push([target, item]);
            else buckets.get(section.key).push(item);
        }
    }

    for (const [target, item] of moved) buckets.get(target).push(item);

    for (const [key, items] of buckets) {
        const order = config.order[key];
        if (!order?.length) continue;

        const rank = item => {
            const index = order.indexOf(item?.key);
            return index === -1 ? order.length : index;
        };
        items.sort((a, b) => rank(a) - rank(b));
    }

    return buckets;
}

function withItems(section, items) {
    const copy = Object.create(Object.getPrototypeOf(section), Object.getOwnPropertyDescriptors(section));
    Object.defineProperty(copy, "buildLayout", {value: () => items, writable: true, configurable: true});
    return copy;
}

function sameOrder(a, b) {
    return a.length === b.length && a.every((item, i) => item === b[i]);
}

function rebuild(layout) {
    snapshot = readSections(layout);
    if (!isCustomized()) return layout;

    const buckets = arrange(snapshot);
    const original = new Map(snapshot.map(({section, items}) => [section.key, items]));

    return layout.flatMap(node => {
        if (!buckets.has(node?.key)) return [node];

        const items = buckets.get(node.key);
        if (sameOrder(items, original.get(node.key))) return [node];
        if (!items.length) return [];
        return [withItems(node, items)];
    });
}

function NodeTitle({node}) {
    const title = node.useTitle?.();
    return typeof title === "string" || React.isValidElement(title) ? title : prettify(node.key);
}

function SafeTitle({node}) {
    return React.createElement(ErrorBoundary, {fallback: prettify(node.key)},
        React.createElement(NodeTitle, {node})
    );
}

function ItemRow({item, sectionKey, sectionOptions, canMoveUp, canMoveDown, onShift, onMove}) {
    return React.createElement("div", {className: "sa-row"},
        React.createElement(Text, {className: "sa-row-title"}, React.createElement(SafeTitle, {node: item})),
        React.createElement(Button, {
            size: Button.Sizes.SMALL,
            color: Button.Colors.PRIMARY,
            disabled: !canMoveUp,
            onClick: () => onShift(-1)
        }, "Up"),
        React.createElement(Button, {
            size: Button.Sizes.SMALL,
            color: Button.Colors.PRIMARY,
            disabled: !canMoveDown,
            onClick: () => onShift(1)
        }, "Down"),
        React.createElement(DropdownInput, {
            value: sectionKey,
            options: sectionOptions,
            onChange: onMove
        })
    );
}

function SettingsPanel() {
    const [, setRevision] = React.useState(0);

    if (!snapshot.length && root) root.buildLayout();

    if (!snapshot.length) {
        return React.createElement(Text, null, "Open the Discord settings once, then come back here.");
    }

    const buckets = arrange(snapshot);
    const origins = new Map();
    for (const {section, items} of snapshot) {
        for (const item of items) {
            if (typeof item?.key === "string") origins.set(item.key, section.key);
        }
    }

    const sectionOptions = snapshot.map(({section}) => ({value: section.key, label: prettify(section.key)}));

    const commit = () => {
        saveConfig();
        setRevision(r => r + 1);
    };

    const shift = (sectionKey, keys, index, delta) => {
        const target = index + delta;
        const next = [...keys];
        [next[index], next[target]] = [next[target], next[index]];
        config.order[sectionKey] = next;
        commit();
    };

    const move = (itemKey, target) => {
        if (target === origins.get(itemKey)) delete config.placement[itemKey];
        else config.placement[itemKey] = target;
        commit();
    };

    const reset = () => {
        config = {placement: {}, order: {}};
        commit();
    };

    return React.createElement("div", {className: "sa-panel"},
        React.createElement(Text, {color: Text.Colors.MUTED},
            "Changes show up the next time you open the Discord settings."
        ),
        snapshot.map(({section}) => {
            const items = buckets.get(section.key).filter(item => typeof item?.key === "string");
            const keys = items.map(item => item.key);

            return React.createElement("div", {className: "sa-section", key: section.key},
                React.createElement(Text, {size: Text.Sizes.SIZE_16, strong: true},
                    React.createElement(SafeTitle, {node: section})
                ),
                items.length === 0 && React.createElement(Text, {className: "sa-empty"}, "Empty, this section is hidden."),
                items.map((item, index) => React.createElement(ItemRow, {
                    key: item.key,
                    item,
                    sectionKey: section.key,
                    sectionOptions,
                    canMoveUp: index > 0,
                    canMoveDown: index < items.length - 1,
                    onShift: delta => shift(section.key, keys, index, delta),
                    onMove: target => move(item.key, target)
                }))
            );
        }),
        React.createElement(Button, {
            color: Button.Colors.RED,
            disabled: !isCustomized(),
            onClick: reset
        }, "Reset everything")
    );
}

module.exports = class SettingsArranger {
    start() {
        loadConfig();
        DOM.addStyle(CSS);

        this.controller = new AbortController();
        Webpack.waitForModule(m => m?.key === "$Root" && typeof m.buildLayout === "function", {
            searchExports: true,
            searchDefault: false,
            signal: this.controller.signal
        }).then(module => {
            if (!module || this.controller.signal.aborted) return;
            root = module;
            Patcher.after(root, "buildLayout", (_, __, layout) => Array.isArray(layout) ? rebuild(layout) : layout);
        }).catch(() => {});
    }

    stop() {
        this.controller?.abort();
        Patcher.unpatchAll();
        DOM.removeStyle();
        root = null;
        snapshot = [];
    }

    getSettingsPanel() {
        return React.createElement(SettingsPanel);
    }
};
