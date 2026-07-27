"use client";

import type { ComponentType } from "react";
import type { BlockType } from "@/lib/blocks/schema";
import { ChecklistBlock, StatsBlock } from "./blocks/checklist-block";
import type { BlockEditProps } from "./edit-types";
import { TextBlock, HeadingBlock, BreadcrumbBlock } from "./blocks/text-block";
import { CodeBlock, MermaidBlock } from "./blocks/code-block";
import { ImageBlock, VideoBlock, EmbedBlock, FileBlock } from "./blocks/media-block";
import { TableBlock } from "./blocks/table-block";
import { ChartBlock } from "./blocks/chart-block";
import { FlowBlock } from "./blocks/flow-block";
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
  breadcrumb: BreadcrumbBlock,
  divider: DividerBlock,
  code: CodeBlock,
  image: ImageBlock,
  video: VideoBlock,
  file: FileBlock,
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
  chart: ChartBlock,
  flow: FlowBlock,
  snippet: SnippetBlock,
  checklist: ChecklistBlock,
  stats: StatsBlock,
} satisfies Record<BlockType, ComponentType<BlockEditProps>>;
