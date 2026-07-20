"use client";

import type { ComponentType } from "react";
import type { BlockType } from "@/lib/blocks/schema";
import type { BlockEditProps } from "./edit-types";
import { TextBlock, HeadingBlock } from "./blocks/text-block";
import { CodeBlock, MermaidBlock } from "./blocks/code-block";
import { ImageBlock, VideoBlock, EmbedBlock } from "./blocks/media-block";
import { TableBlock } from "./blocks/table-block";
import {
  DividerBlock,
  SpacerBlock,
  ButtonBlock,
  HeroBlock,
  SnippetBlock,
  AccordionItemBlock,
  TabBlock,
  CardBlock,
  ListItemBlock,
} from "./blocks/simple-block";
import {
  ListBlock,
  CalloutBlock,
  PanelBlock,
  ContainerBlock,
  ColumnBlock,
  StepsBlock,
  StepBlock,
  ToggleBlock,
  AccordionBlock,
  TabsBlock,
  CardGridBlock,
} from "./blocks/container-block";

/** type → componente de edição. Exaustivo (satisfies). */
export const EDITORS = {
  paragraph: TextBlock,
  heading: HeadingBlock,
  bulletList: ListBlock,
  orderedList: ListBlock,
  listItem: ListItemBlock,
  quote: TextBlock,
  divider: DividerBlock,
  code: CodeBlock,
  image: ImageBlock,
  video: VideoBlock,
  embed: EmbedBlock,
  button: ButtonBlock,
  callout: CalloutBlock,
  steps: StepsBlock,
  step: StepBlock,
  accordion: AccordionBlock,
  accordionItem: AccordionItemBlock,
  tabs: TabsBlock,
  tab: TabBlock,
  toggle: ToggleBlock,
  container: ContainerBlock,
  column: ColumnBlock,
  panel: PanelBlock,
  cardGrid: CardGridBlock,
  card: CardBlock,
  hero: HeroBlock,
  spacer: SpacerBlock,
  table: TableBlock,
  mermaid: MermaidBlock,
  snippet: SnippetBlock,
} satisfies Record<BlockType, ComponentType<BlockEditProps>>;
