/**
 * Catálogo de ícones das regiões/cards (biblioteca lucide), agrupado por tema
 * para o seletor de ícones. Fonte ÚNICA — usada pelo render do portal e pelo
 * editor, para o ícone escolhido aparecer igual nos dois.
 *
 * Só as chaves deste catálogo são aceitas (whitelist): nada de nome de ícone
 * arbitrário vindo do conteúdo.
 */
import {
  AlertTriangle, Award, BadgeCheck, Bell, BookOpen, Bookmark, Briefcase, Building2,
  Calendar, Camera, CheckCircle2, ClipboardList, Clock, Cloud, Code2, Compass,
  CreditCard, Database, Download, Eye, FileText, Filter, Flag, Folder, Gauge, Gift,
  Globe, GraduationCap, HeartHandshake, HelpCircle, Home, Image, Info, Key, Layers,
  Lightbulb, Link2, Lock, Mail, MapPin, MessageSquare, Monitor, Package, Percent,
  Phone, PieChart, PlayCircle, Plug, Printer, Rocket, Search, Settings, Shield,
  ShoppingCart, Smartphone, Sparkles, Star, Tag, Target, Terminal, ThumbsUp, Timer,
  Trash2, TrendingUp, Truck, Upload, UserPlus, Users, Video, Wallet, Wrench, Zap,
  type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  book: BookOpen, file: FileText, folder: Folder, clipboard: ClipboardList,
  bookmark: Bookmark, tag: Tag, flag: Flag, layers: Layers, package: Package,

  rocket: Rocket, sparkles: Sparkles, zap: Zap, star: Star, award: Award,
  target: Target, trending: TrendingUp, gauge: Gauge, percent: Percent, chart: PieChart,

  info: Info, help: HelpCircle, lightbulb: Lightbulb, alert: AlertTriangle,
  check: CheckCircle2, badge: BadgeCheck, bell: Bell, eye: Eye, search: Search,
  filter: Filter,

  settings: Settings, wrench: Wrench, terminal: Terminal, code: Code2,
  database: Database, plug: Plug, cloud: Cloud, monitor: Monitor, smartphone: Smartphone,
  printer: Printer,

  shield: Shield, lock: Lock, key: Key,

  users: Users, userPlus: UserPlus, message: MessageSquare, mail: Mail, phone: Phone,
  handshake: HeartHandshake, thumbsUp: ThumbsUp, graduation: GraduationCap,

  home: Home, building: Building2, briefcase: Briefcase, globe: Globe, mapPin: MapPin,
  compass: Compass, truck: Truck,

  calendar: Calendar, clock: Clock, timer: Timer,

  cart: ShoppingCart, card: CreditCard, wallet: Wallet, gift: Gift,

  image: Image, video: Video, camera: Camera, play: PlayCircle,
  download: Download, upload: Upload, link: Link2, trash: Trash2,
};

/** Grupos exibidos no seletor de ícones. */
export const ICON_GROUPS: { label: string; keys: string[] }[] = [
  { label: "Conteúdo", keys: ["book", "file", "folder", "clipboard", "bookmark", "tag", "flag", "layers", "package"] },
  { label: "Destaque", keys: ["rocket", "sparkles", "zap", "star", "award", "target", "trending", "gauge", "percent", "chart"] },
  { label: "Avisos", keys: ["info", "help", "lightbulb", "alert", "check", "badge", "bell", "eye", "search", "filter"] },
  { label: "Técnico", keys: ["settings", "wrench", "terminal", "code", "database", "plug", "cloud", "monitor", "smartphone", "printer"] },
  { label: "Segurança", keys: ["shield", "lock", "key"] },
  { label: "Pessoas", keys: ["users", "userPlus", "message", "mail", "phone", "handshake", "thumbsUp", "graduation"] },
  { label: "Lugares", keys: ["home", "building", "briefcase", "globe", "mapPin", "compass", "truck"] },
  { label: "Tempo", keys: ["calendar", "clock", "timer"] },
  { label: "Comércio", keys: ["cart", "card", "wallet", "gift"] },
  { label: "Mídia", keys: ["image", "video", "camera", "play", "download", "upload", "link", "trash"] },
];

/** Ícone pela chave (null se a chave não existir no catálogo). */
export function iconByKey(key: string | undefined): LucideIcon | null {
  if (!key) return null;
  return ICONS[key] ?? null;
}

/**
 * Blocos que posicionam o ícone JUNTO DO PRÓPRIO TÍTULO. Os demais recebem o
 * ícone no topo da região. Fonte única, para o editor e o portal desenharem o
 * ícone no mesmo lugar.
 */
export const ICON_IN_TITLE: ReadonlySet<string> = new Set([
  "callout",
  "toggle",
  "accordionItem",
  "card",
  "hero",
]);
