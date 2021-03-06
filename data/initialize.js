/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Initialization routines
 *
 * Those codes bridge the SVG DOM and the CompassMenu object
 * as well as attach the menu to the page.
 * Those codes depend heavily on details of the SVG document.
 *
 * An iframe with SVG document is injected into document body.
 * Since we should avoid slowdown of page loading as much as possible,
 * the menu icons are loaded when the user presses a mouse button.
 *
 * We need the iframe to be populated when a mouse button is pressed,
 * so that we need to insert the iframe element before mouse press events.
 *
 * We initialize the menu with following steps:
 * 1. Wait for the insertion of the body element.
 * 2. Inject an iframe element with menu.svg into the body element.
 * 3. When the user presses a mouse button, load the menu icons asynchronously.
 */

"use strict";

/**
 * Range generator.
 *
 * @param {number} start The start of the range, inclusive
 * @param {number} end The end of the range, exclusive
 */
function* range(start, end) {
    for (var i = start; i < end; i++) {
        yield i;
    }
}

/**
 * @return {Array.<Node>} The elements with id prefix0, ..., prefix7
 * @param {Document} ownerDocument The document contains the elements.
 * @param {string} prefix The prefix of the ID.
 */
function getNumberedElements(ownerDocument, prefix) {
    return [...range(0, 8)]
        .map((i) => ownerDocument.getElementById(prefix + i));
}

/**
 * @return {Array.<function(string)>} An array of functions setting label text.
 *     Passing null to functions hides balloon.
 * @param {Document} ownerDocument The owner document.
 */
function createTextSetters(ownerDocument) {
    /**
     * @return {function(string)}
     *     A function updates text node and adjust balloon.
     *
     * @param {Node} balloonElement The group element grouping entire balloon.
     * @param {Node} textElement The text element.
     * @param {function(Node): SVGRect} getBoundingBox
     *   A function returns the size of the text element
     *   excluding transformations applied to the element.
     * @param {Node} rectFillElement
     *     The element filling the body of the balloon.
     * @param {Node} rectStrokeElement
     *     The element drawing the outline of the body of the balloon.
     * @param {Node} circleFillElement
     *     The element filling the opposite side of the tail.
     * @param {Node} circleStrokeElement
     *     The element drawing the outline of the opposite side of the tail.
     * @param {boolean} isLeftToRight
     *     true iff the text is from left to right.
     */
    function textSetter(balloonElement,
                        textElement,
                        getBoundingBox,
                        rectFillElement, rectStrokeElement,
                        circleFillElement, circleStrokeElement,
                        isLeftToRight) {
        function doSetText(text) {
            balloonElement.style.display = 'inline';
            textElement.style.display = 'inline';

            textElement.textContent = text;

            var boundingBox = getBoundingBox(textElement);
            var widthText = boundingBox.width.toString();

            rectFillElement.setAttribute("width", widthText);
            rectStrokeElement.setAttribute("width", widthText);

            if (isLeftToRight) {
                var left = textElement.x.baseVal.getItem(0).value;
                var x = left + boundingBox.width;

                circleFillElement.setAttribute("cx", x);
                circleStrokeElement.setAttribute("cx", x);
            } else {
                var right = textElement.x.baseVal.getItem(0).value;
                var x = right - boundingBox.width;

                circleFillElement.setAttribute("cx", x);
                circleStrokeElement.setAttribute("cx", x);

                rectFillElement.setAttribute("x", x);
                rectStrokeElement.setAttribute("x", x);
            }
        }

        return function(text) {
            if (text) {
                doSetText(text);
            } else {
                balloonElement.style.display = 'none';
                textElement.style.display = 'none';
            }
        };
    }

    /**
     * @return {SVGRect} The bounding box of the givien element.
     * @param {Node} textElement The element to be measured.
     */
    function simpleGetBoundingBox(textElement) {
        return textElement.getBBox();
    }

    /**
     * The invisible text element
     *
     * @type {Node}
     */
    var shadowTextElement = ownerDocument.getElementById("shadow_text");

    /**
     * Returns the bounding box of the givien element excluding transformations.
     *
     * The given element is assumed to have the same styles to
     * the shadow text element.
     *
     * @return {SVGRect} The bounding box of the givien element
     *     excluding transformations.
     * @param {Node} textElement The element to be measured.
     */
    function tiltedGetBoundingBox(textElement) {
        shadowTextElement.style.display = 'inline';

        shadowTextElement.textContent = textElement.textContent;

        var boundingBox = shadowTextElement.getBBox();

        shadowTextElement.style.display = 'none';

        return boundingBox;
    }

    var balloonElements = getNumberedElements(ownerDocument, "balloon");
    var textElements = getNumberedElements(ownerDocument, "text");
    var rectFillElements = getNumberedElements(ownerDocument, "rect_fill");
    var rectStrokeElements = getNumberedElements(ownerDocument, "rect_stroke");
    var circleFillElements = getNumberedElements(ownerDocument, "circle_fill");
    var circleStrokeElements = getNumberedElements(ownerDocument, "circle_stroke");

    var getBoundingBoxes = [
        simpleGetBoundingBox, simpleGetBoundingBox,
        tiltedGetBoundingBox, simpleGetBoundingBox,
        simpleGetBoundingBox, simpleGetBoundingBox,
        tiltedGetBoundingBox, simpleGetBoundingBox
    ];

    var isLeftToRights = [
        true, true, false, false,
        false, false, true, true
    ];

    return [...range(0, 8)]
        .map((i) =>
             textSetter(balloonElements[i], textElements[i],
                        getBoundingBoxes[i],
                        rectFillElements[i], rectStrokeElements[i],
                        circleFillElements[i], circleStrokeElements[i],
                        isLeftToRights[i]));
}

/**
 * The initialization routine.
 *
 * The function is called when the user pressed button
 * before the menu is initialized.
 *
 * @param {MouseEvent} event The mouse event.
 */
function initialize(event, iframe) {
    self.port.on("pageState", onPageState);

    iframe.style.display = "inline";

    var ownerDocument = iframe.contentDocument;

    /** The element representing the entire menu including labels */
    var menuNode = ownerDocument.getElementById("menu");

    // If the page is zoomed, it seems that content size may be rounded up
    // while iframe size may be rounded down.
    // I am not sure this is specified.
    // FIXME: assuming menuNode.getAttribute("width") is in px.
    iframe.style.width = parseInt(menuNode.getAttribute("width")) + 1 + "px";
    iframe.style.height = parseInt(menuNode.getAttribute("height")) + 1 + "px";

    /** The element representing the outer ring. */
    var outer = ownerDocument.getElementById("outer");

    /** The element representing the inner hole. */
    var hole = ownerDocument.getElementById("hole");

    /** The elements representing the menu item icons. */
    var itemElements = getNumberedElements(ownerDocument, "item");

    /** The elements representing the children indicator. */
    var markerElements = getNumberedElements(ownerDocument, "marker");

    /**
     * An array of functions setting label text.
     * Passing null to functions hides balloon.
     */
    var textSetters = createTextSetters(ownerDocument);

    var menu = new PieMenu(iframe,
                           menuNode,
                           outer,
                           hole,
                           itemElements,
                           markerElements,
                           textSetters,
                           contexts,
                           menuFilters,
                           self.options.config,
                           self.options.localizedLabels);

    loadIconsAsync(ownerDocument);

    self.port.on("configChanged", menu.setConfig.bind(menu));
    menu.onMouseDown(event);
}

/**
 * Loads menu icons asynchronously and inject them into the SVG document.
 */
function loadIconsAsync(ownerDocument) {
    // XMLHttpRequest fails silently for custom URL scheme.
    // xlink:href does not work neither.
    // Using iframe instead.

    var iframe = document.createElement("iframe");

    iframe.src = "res-compass-menu-at-tatapa-dot-org://compass_menu-at-tatapa-dot-org/data/menu_icons.svg";

    iframe.onload = function() {
        ownerDocument.documentElement.appendChild(iframe.contentDocument.getElementById("icon_defs"));
        document.body.removeChild(iframe);
    };

    iframe.style.display = "none";

    document.body.appendChild(iframe);
}

self.port.on("configChanged", function(config) {
                 self.options.config = config;
             });

/**
 * Injects an iframe element into body and adds an event listener for
 * mousepress events to initialize the menu.
 *
 * The function is called when the body element is inserted.
 */
function onBodyAdded() {
    // document.body.dataset seems not to be ready.
    if (document.documentElement.getAttribute('data-supress-compass-menu')) {
        // The document is the menu itself
        // (or some document not willing CompassMenu).
        // Supressing the menu.

        self.options = null;

        return;
    }

    var iframe = document.createElement("iframe");

    iframe.style.borderStyle = "none";
    iframe.style.outline = "none";
    iframe.style.backgroundColor = "transparent";
    iframe.style.position = "absolute";
    iframe.style.margin = "0";
    iframe.style.padding = "0";
    iframe.style.zIndex = "2147483647";
    iframe.style.display = "none";

    iframe.src = "res-compass-menu-at-tatapa-dot-org://compass_menu-at-tatapa-dot-org/data/menu.svg";

    document.body.appendChild(iframe);

    function listener(event) {
        window.removeEventListener("mousedown", listener, false);

        initialize(event, iframe);
    };

    window.addEventListener("mousedown", listener, false);
}

if (document.body) {
    onBodyAdded();
} else {
    var onMutate = function(records) {
        if (document.body) {
            mutationObserver.disconnect();

            onBodyAdded();
        }
    };

    var mutationObserver = new MutationObserver(onMutate);

    mutationObserver.observe(document.documentElement, {
                                 childList: true
                             });
}
