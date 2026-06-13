# Vocabify UI Design System

## Product Philosophy

Lexicon is a professional language learning tool, not a consumer education app, not a gamified vocabulary trainer, and not an enterprise admin dashboard.

The UI should feel closer to:

* Raycast
* Linear
* Obsidian
* Readwise Reader
* VSCode
* Adobe Creative Tools

Avoid visual patterns from:

* Duolingo
* Notion
* Ant Design admin dashboards
* Material Design showcase apps
* Consumer social products

Core principle:

> Dense but Calm

The interface should maximize information recognition speed while minimizing visual fatigue.

---

# Visual Priorities

Order of importance:

1. Information clarity
2. Information density
3. Interaction efficiency
4. Visual aesthetics

Never sacrifice readability or scanning speed for decoration.

---

# Design Language

## Minimalism

Use as little visual decoration as possible.

Avoid:

* Large illustrations
* Decorative gradients
* Heavy shadows
* Glassmorphism
* Unnecessary animations
* Colorful UI

Prefer:

* Typography
* Spacing
* Subtle borders
* Clear hierarchy

---

## Dark Professional Theme

Backgrounds should use dark gray rather than pure black.

Examples:

```css
--bg: #2b2b2b;
--panel: #323232;
--panel-secondary: #3a3a3a;
```

Never use:

```css
#000000
```

The product should feel professional, not hacker-themed.

---

## Accent Color Usage

Accent color exists only to indicate:

* Current state
* Selection
* Focus
* Primary action

It must never be used as decoration.

Example:

```css
--primary: #5b5bf8;
```

Only one primary accent color should exist.

---

# Layout Rules

## Information First

Layouts should optimize scanning.

Prefer:

* Lists
* Panels
* Sidebars
* Stacked information

Avoid:

* Marketing-style cards
* Dashboard widgets
* Masonry layouts

---

## Left Alignment

All reading-related content should be left aligned.

Examples:

* Word
* Pronunciation
* Definition
* Example sentence
* Notes

Avoid center alignment.

Language learning is a scanning activity.

---

## Density

Target high information density.

Users should see:

* More words
* More context
* More review state

without feeling crowded.

Prefer:

* Compact spacing
* Compact lists
* Compact controls

Avoid oversized UI.

---

# Spacing System

Use an 8pt grid.

Allowed spacing:

```txt
4
8
12
16
24
32
48
```

Most layouts should be built from:

```txt
8
12
16
```

Avoid arbitrary values.

---

# Border System

Use borders instead of shadows.

Preferred:

```css
border: 1px solid rgba(255,255,255,0.08);
```

Avoid:

```css
box-shadow: 0 10px 40px ...
```

The UI should feel engineered rather than decorative.

---

# Typography

Typography is the primary hierarchy mechanism.

Hierarchy:

```txt
Word
Pronunciation
Definition
Metadata
```

Do not rely on color for hierarchy.

Use:

* font size
* weight
* spacing

instead.

---

# Component Principles

## Word List Items

Each item should expose:

* term
* pronunciation
* definition
* type
* memory state

within a single row or compact block.

Users should not need to open details to understand status.

---

## Hover Cards

Hover should be preferred over navigation.

Goal:

```txt
Recognize
→ Hover
→ Learn
→ Continue Reading
```

Avoid:

```txt
Click
→ Open Page
→ Read
→ Close
→ Return
```

Learning should not interrupt reading flow.

---

## Modals

Modals should be focused and task-oriented.

One modal = one decision.

Examples:

* Save word
* Edit word
* Review card

Avoid large multi-step forms.

---

# Interaction Design

## Keyboard First

Every high-frequency action should support shortcuts.

Examples:

```txt
Save
Edit
Review
Search
Navigate
```

Mouse is optional.

Keyboard is primary.

---

## Fast Response

Interactions should feel immediate.

Target:

* Instant hover feedback
* Instant search results
* Minimal loading states

Perceived speed is critical.

---

# Animation

Use animation only when it improves understanding.

Allowed:

* Hover transitions
* Panel open/close
* Selection state changes

Duration:

```txt
150ms - 250ms
```

Avoid:

* Bounce
* Elastic
* Large movement
* Decorative motion

---

# Design Test

Before shipping any UI, verify:

1. Does it look like a professional tool rather than a learning toy?
2. Can a user identify word status within 200ms?
3. Can a user complete the task without opening a new page?
4. Is information density high without feeling cluttered?
5. Would this feel natural inside Raycast, Obsidian, or VSCode?

If the answer is no, redesign.

这份规范最大的价值是：它定义的是**决策原则**，而不是颜色和圆角。AI 在生成新页面、新组件时，会自动保持同一种产品气质，而不会随着需求增长逐渐变成 Ant Design 风格的大后台。



------------






# Color Usage Philosophy

## Core Principle

Color is expensive.

Every additional color increases cognitive load.

Lexicon is a professional language-learning workspace, not a gamified vocabulary app.

Users should focus on words and meaning, not on UI decoration.

---

## Color Budget

The entire interface should feel:

```txt
90-95% neutral colors
5-10% accent colors
```

Most of the UI should be built from:

* dark gray
* medium gray
* light gray
* white

Accent colors should be rare.

When everything is colorful, nothing stands out.

---

## Single Accent Strategy

The interface should have only one primary accent color.

Example:

```txt
Indigo
Purple
Blue-violet
```

This accent color is reserved for:

* active state
* selected state
* keyboard focus
* primary action

Do not introduce additional colors unless absolutely necessary.

---

## Avoid Semantic Rainbow UI

Never assign different colors to:

* noun
* verb
* adjective
* phrase
* sentence
* grammar pattern

Avoid:

```txt
noun = blue
verb = green
adjective = yellow
phrase = pink
```

This creates visual noise without increasing learning efficiency.

Word type is metadata, not a primary visual signal.

Prefer neutral badges.

---

## Memory Status Should Be Quiet

Learning state should not dominate the interface.

Avoid:

```txt
red = unfamiliar
yellow = learning
green = mastered
```

Large colored indicators create anxiety and visual fatigue.

Prefer:

* subtle dots
* progress rings
* grayscale indicators
* opacity differences

The user should notice the word first and the status second.

---

## Recognition Before Status

Visual hierarchy should follow:

```txt
Word
Meaning
Example
Status
Metadata
```

Never allow status colors to become more visually prominent than the word itself.

The vocabulary item is always the primary focus.

---

## Professional Tool Aesthetic

Reference products:

* Linear
* Raycast
* Obsidian
* VSCode
* Readwise Reader

Non-reference products:

* Duolingo
* Mobile habit trackers
* Children's learning apps
* Gamified education products

The interface should feel calm, focused, and trustworthy.

---

## When Unsure

Remove color.

If a design decision can be solved using:

* typography
* spacing
* weight
* grouping
* borders

then do not introduce a new color.

Color should be the last tool, not the first.

---

## Final Design Test

Before adding a new color, ask:

1. Does this color communicate critical information?
2. Can the same problem be solved using typography or layout?
3. Will this color still make sense with 5,000+ vocabulary entries?
4. Does it reduce cognitive load or increase it?

If uncertain, do not add the color.
