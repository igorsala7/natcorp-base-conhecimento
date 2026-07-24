/**
 * Catálogo de ícones das regiões/cards (biblioteca lucide), agrupado por tema
 * para o seletor de ícones. Fonte ÚNICA — usada pelo render do portal e pelo
 * editor, para o ícone escolhido aparecer igual nos dois.
 *
 * Só as chaves deste catálogo são aceitas (whitelist): nada de nome de ícone
 * arbitrário vindo do conteúdo. As chaves ANTIGAS são preservadas (conteúdo já
 * salvo continua apontando para o mesmo ícone).
 */
import {
  AlarmClock, AlertCircle, AlertOctagon, AlertTriangle, Anchor, Aperture, Apple, Archive,
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, AtSign, Award, BadgeCheck, BadgeDollarSign,
  BadgePercent, Ban, Banknote, BarChart3, Battery, Bed, Bell, BellRing, Bike, Binary, Bird,
  Bluetooth, Bold, BookMarked, BookOpen, Bookmark, Box, Boxes, Braces, Briefcase, Brush, Bug,
  Building2, Bus, Cake, Calculator, Calendar, CalendarCheck, CalendarClock, CalendarDays, Camera,
  Car, CheckCheck, CheckCircle2, ChevronRight, ClipboardCheck, ClipboardList, Clock, Cloud,
  CloudRain, CloudSnow, Cloudy, Code2, Coffee, Cog, Coins, Command, Compass, Contact, Container,
  Cookie, Cpu, CreditCard, Crop, Cross, Crown, Database, Diamond, DollarSign, Dot, Download,
  Droplet, Dumbbell, Ear, Eraser, Euro, ExternalLink, Eye, EyeOff, Factory, Feather, FileCode,
  FileText, Files, Film, Filter, Fingerprint, Flag, Flame, Flashlight, FlaskConical, Flower,
  Folder, FolderOpen, Footprints, Fuel, Gamepad2, Gauge, Gem, Gift, GitBranch, GitCommit, Globe,
  GraduationCap, Grid, HandHeart, HandHelping, HardDrive, Hash, Headphones, Heart, HeartHandshake,
  HeartPulse, HelpCircle, Highlighter, History, Home, Hospital, Hotel, Hourglass, Image, ImagePlus,
  Inbox, Infinity, Info, Kanban, Key, KeyRound, Keyboard, Lamp, Landmark, Laptop, Layers,
  LayoutDashboard, LayoutGrid, Leaf, Library, Lightbulb, LineChart, Link2, List, ListChecks,
  ListOrdered, Loader, Lock, LockKeyhole, Magnet, Mail, MailOpen, Map, MapPin, MapPinned, Medal,
  Megaphone, MessageCircle, MessageSquare, MessagesSquare, Mic, Milestone, Monitor, Moon, Mountain,
  Mouse, Music, Navigation, Network, Newspaper, Notebook, Package, Palette, PanelsTopLeft, Paperclip,
  PartyPopper, PawPrint, PenTool, Pencil, Percent, Phone, PhoneCall, PieChart, PiggyBank, Pill, Pin,
  Pizza, Plane, PlayCircle, Plug, Plus, Podcast, Power, Printer, Puzzle, QrCode, Quote, Radio,
  Receipt, Recycle, RefreshCw, Repeat, Reply, Rocket, Rss, Ruler, Scale, Scan, ScanFace, School, Scissors,
  ScrollText, Search, Send, Server, Settings, Settings2, Share2, Shield, ShieldAlert, ShieldCheck,
  Ship, ShoppingBag, ShoppingBasket, ShoppingCart, Shuffle, SlidersHorizontal, Smartphone, Smile,
  Snowflake, Sparkles, Speaker, Speech, Sprout, Star, Stethoscope, StickyNote, Store, Sun, Sunrise,
  Sunset, Table, Tablet, Tag, Target, Tent, Terminal, ThumbsDown, ThumbsUp, Ticket, Timer,
  ToggleLeft, Train, TreePine, Trees, TrendingDown, TrendingUp, Trash2, Trophy, Truck, Tv, Type,
  Umbrella, Unlock, Upload, Usb, User, UserCheck, UserPlus, Users, Users2, Utensils, Video, Voicemail,
  Volume2, Wallet, Watch, Webhook, Wifi, Wind, Wine, Workflow, Wrench, Zap,
  type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  // Conteúdo e arquivos
  book: BookOpen, bookMarked: BookMarked, file: FileText, fileCode: FileCode, files: Files,
  notebook: Notebook, newspaper: Newspaper, scroll: ScrollText, note: StickyNote,
  clipboard: ClipboardList, clipboardCheck: ClipboardCheck, folder: Folder, folderOpen: FolderOpen,
  archive: Archive, inbox: Inbox, library: Library, paperclip: Paperclip, bookmark: Bookmark,
  tag: Tag, flag: Flag, layers: Layers, package: Package, box: Box, boxes: Boxes, container: Container,
  quote: Quote, list: List, checklist: ListChecks, numberedList: ListOrdered, table: Table,
  kanban: Kanban, grid: Grid, layoutGrid: LayoutGrid, dashboard: LayoutDashboard, panels: PanelsTopLeft,

  // Destaque, métricas e conquistas
  rocket: Rocket, sparkles: Sparkles, zap: Zap, star: Star, award: Award, trophy: Trophy,
  medal: Medal, crown: Crown, gem: Gem, diamond: Diamond, flame: Flame, heart: Heart,
  thumbsUp: ThumbsUp, thumbsDown: ThumbsDown, target: Target, gauge: Gauge, trending: TrendingUp,
  trendingDown: TrendingDown, percent: Percent, chart: PieChart, barChart: BarChart3,
  lineChart: LineChart, megaphone: Megaphone, party: PartyPopper, ticket: Ticket, scale: Scale,

  // Avisos e status
  info: Info, help: HelpCircle, lightbulb: Lightbulb, alert: AlertTriangle, alertCircle: AlertCircle,
  alertOctagon: AlertOctagon, check: CheckCircle2, checkCheck: CheckCheck, badge: BadgeCheck,
  bell: Bell, bellRing: BellRing, eye: Eye, eyeOff: EyeOff, search: Search, filter: Filter,
  ban: Ban, loader: Loader, refresh: RefreshCw, history: History, hourglass: Hourglass,

  // Técnico e desenvolvimento
  settings: Settings, settings2: Settings2, cog: Cog, sliders: SlidersHorizontal, wrench: Wrench,
  terminal: Terminal, code: Code2, braces: Braces, binary: Binary, database: Database, server: Server,
  hardDrive: HardDrive, cpu: Cpu, plug: Plug, power: Power, cloud: Cloud, monitor: Monitor,
  laptop: Laptop, tablet: Tablet, smartphone: Smartphone, mouse: Mouse, keyboard: Keyboard,
  command: Command, printer: Printer, network: Network, wifi: Wifi, bluetooth: Bluetooth, usb: Usb,
  webhook: Webhook, gitBranch: GitBranch, gitCommit: GitCommit, bug: Bug, puzzle: Puzzle,
  workflow: Workflow, toggle: ToggleLeft, scan: Scan,

  // Segurança
  shield: Shield, shieldCheck: ShieldCheck, shieldAlert: ShieldAlert, lock: Lock,
  lockKeyhole: LockKeyhole, unlock: Unlock, key: Key, keyRound: KeyRound, fingerprint: Fingerprint,
  scanFace: ScanFace,

  // Pessoas e comunicação
  users: Users, users2: Users2, user: User, userPlus: UserPlus, userCheck: UserCheck,
  contact: Contact, message: MessageSquare, messageCircle: MessageCircle, messages: MessagesSquare,
  mail: Mail, mailOpen: MailOpen, phone: Phone, phoneCall: PhoneCall, send: Send, reply: Reply,
  share: Share2, atSign: AtSign, hash: Hash, handshake: HeartHandshake, handHeart: HandHeart,
  handHelping: HandHelping, smile: Smile, speech: Speech, voicemail: Voicemail, graduation: GraduationCap,

  // Lugares e transporte
  home: Home, building: Building2, briefcase: Briefcase, store: Store, factory: Factory, hotel: Hotel,
  hospital: Hospital, school: School, landmark: Landmark, tent: Tent, mountain: Mountain,
  treePine: TreePine, trees: Trees, globe: Globe, mapPin: MapPin, mapPinned: MapPinned, map: Map,
  navigation: Navigation, milestone: Milestone, compass: Compass, anchor: Anchor, footprints: Footprints,
  truck: Truck, plane: Plane, car: Car, bus: Bus, train: Train, ship: Ship, bike: Bike, fuel: Fuel,

  // Tempo e clima
  calendar: Calendar, calendarDays: CalendarDays, calendarCheck: CalendarCheck,
  calendarClock: CalendarClock, clock: Clock, alarm: AlarmClock, watch: Watch, timer: Timer,
  sun: Sun, sunrise: Sunrise, sunset: Sunset, moon: Moon, cloudRain: CloudRain, cloudSnow: CloudSnow,
  cloudy: Cloudy, wind: Wind, snowflake: Snowflake, droplet: Droplet, umbrella: Umbrella,

  // Comércio e finanças
  cart: ShoppingCart, bag: ShoppingBag, basket: ShoppingBasket, card: CreditCard, wallet: Wallet,
  gift: Gift, receipt: Receipt, dollar: DollarSign, euro: Euro, banknote: Banknote, coins: Coins,
  piggy: PiggyBank, calculator: Calculator, badgePercent: BadgePercent, badgeDollar: BadgeDollarSign,
  qr: QrCode,

  // Mídia e arte
  image: Image, imagePlus: ImagePlus, video: Video, film: Film, camera: Camera, play: PlayCircle,
  music: Music, mic: Mic, headphones: Headphones, speaker: Speaker, volume: Volume2, radio: Radio,
  podcast: Podcast, tv: Tv, palette: Palette, brush: Brush, penTool: PenTool, pencil: Pencil,
  highlighter: Highlighter, crop: Crop, scissors: Scissors, eraser: Eraser, type: Type, bold: Bold,
  aperture: Aperture, feather: Feather, download: Download, upload: Upload, link: Link2,
  externalLink: ExternalLink, rss: Rss, trash: Trash2,

  // Natureza, comida e saúde
  leaf: Leaf, flower: Flower, sprout: Sprout, bird: Bird, paw: PawPrint, coffee: Coffee, apple: Apple,
  wine: Wine, cake: Cake, pizza: Pizza, cookie: Cookie, utensils: Utensils, heartPulse: HeartPulse,
  stethoscope: Stethoscope, pill: Pill, cross: Cross, dumbbell: Dumbbell, bed: Bed,

  // Objetos, ferramentas e símbolos
  ruler: Ruler, magnet: Magnet, flashlight: Flashlight, lamp: Lamp, battery: Battery, recycle: Recycle,
  flask: FlaskConical, gamepad: Gamepad2, ear: Ear, pin: Pin, plus: Plus, dot: Dot, infinity: Infinity,
  repeat: Repeat, shuffle: Shuffle, arrowRight: ArrowRight, arrowLeft: ArrowLeft, arrowUp: ArrowUp,
  arrowDown: ArrowDown, chevronRight: ChevronRight,
};

/** Grupos exibidos no seletor de ícones (a ordem é a de exibição). */
export const ICON_GROUPS: { label: string; keys: string[] }[] = [
  { label: "Conteúdo", keys: ["book", "bookMarked", "file", "fileCode", "files", "notebook", "newspaper", "scroll", "note", "clipboard", "clipboardCheck", "folder", "folderOpen", "archive", "inbox", "library", "paperclip", "bookmark", "tag", "flag", "layers", "package", "box", "boxes", "container", "quote", "list", "checklist", "numberedList", "table", "kanban", "grid", "layoutGrid", "dashboard", "panels"] },
  { label: "Destaque", keys: ["rocket", "sparkles", "zap", "star", "award", "trophy", "medal", "crown", "gem", "diamond", "flame", "heart", "thumbsUp", "thumbsDown", "target", "gauge", "trending", "trendingDown", "percent", "chart", "barChart", "lineChart", "megaphone", "party", "ticket", "scale"] },
  { label: "Avisos", keys: ["info", "help", "lightbulb", "alert", "alertCircle", "alertOctagon", "check", "checkCheck", "badge", "bell", "bellRing", "eye", "eyeOff", "search", "filter", "ban", "loader", "refresh", "history", "hourglass"] },
  { label: "Técnico", keys: ["settings", "settings2", "cog", "sliders", "wrench", "terminal", "code", "braces", "binary", "database", "server", "hardDrive", "cpu", "plug", "power", "cloud", "monitor", "laptop", "tablet", "smartphone", "mouse", "keyboard", "command", "printer", "network", "wifi", "bluetooth", "usb", "webhook", "gitBranch", "gitCommit", "bug", "puzzle", "workflow", "toggle", "scan"] },
  { label: "Segurança", keys: ["shield", "shieldCheck", "shieldAlert", "lock", "lockKeyhole", "unlock", "key", "keyRound", "fingerprint", "scanFace"] },
  { label: "Pessoas", keys: ["users", "users2", "user", "userPlus", "userCheck", "contact", "message", "messageCircle", "messages", "mail", "mailOpen", "phone", "phoneCall", "send", "reply", "share", "atSign", "hash", "handshake", "handHeart", "handHelping", "smile", "speech", "voicemail", "graduation"] },
  { label: "Lugares", keys: ["home", "building", "briefcase", "store", "factory", "hotel", "hospital", "school", "landmark", "tent", "mountain", "treePine", "trees", "globe", "mapPin", "mapPinned", "map", "navigation", "milestone", "compass", "anchor", "footprints", "truck", "plane", "car", "bus", "train", "ship", "bike", "fuel"] },
  { label: "Tempo e clima", keys: ["calendar", "calendarDays", "calendarCheck", "calendarClock", "clock", "alarm", "watch", "timer", "sun", "sunrise", "sunset", "moon", "cloudRain", "cloudSnow", "cloudy", "wind", "snowflake", "droplet", "umbrella"] },
  { label: "Comércio", keys: ["cart", "bag", "basket", "card", "wallet", "gift", "receipt", "dollar", "euro", "banknote", "coins", "piggy", "calculator", "badgePercent", "badgeDollar", "qr"] },
  { label: "Mídia", keys: ["image", "imagePlus", "video", "film", "camera", "play", "music", "mic", "headphones", "speaker", "volume", "radio", "podcast", "tv", "palette", "brush", "penTool", "pencil", "highlighter", "crop", "scissors", "eraser", "type", "bold", "aperture", "feather", "download", "upload", "link", "externalLink", "rss", "trash"] },
  { label: "Natureza e saúde", keys: ["leaf", "flower", "sprout", "bird", "paw", "coffee", "apple", "wine", "cake", "pizza", "cookie", "utensils", "heartPulse", "stethoscope", "pill", "cross", "dumbbell", "bed"] },
  { label: "Objetos e símbolos", keys: ["ruler", "magnet", "flashlight", "lamp", "battery", "recycle", "flask", "gamepad", "ear", "pin", "plus", "dot", "infinity", "repeat", "shuffle", "arrowRight", "arrowLeft", "arrowUp", "arrowDown", "chevronRight"] },
];

/**
 * Sinônimos (pt/en) para a busca do seletor — com centenas de ícones, procurar
 * só pela chave não basta. A busca casa a chave OU estas palavras. Nem todo
 * ícone precisa de entrada: sem sinônimo, ainda é encontrado pela própria chave.
 */
export const ICON_KEYWORDS: Record<string, string> = {
  book: "livro manual documento", bookMarked: "livro marcado favorito", file: "arquivo documento",
  fileCode: "arquivo codigo", files: "arquivos documentos", notebook: "caderno anotacoes",
  newspaper: "jornal noticia noticias", scroll: "pergaminho texto rolagem", note: "nota lembrete post-it",
  clipboard: "prancheta lista tarefas", clipboardCheck: "prancheta feito concluido", folder: "pasta diretorio",
  folderOpen: "pasta aberta", archive: "arquivo morto caixa", inbox: "caixa entrada", library: "biblioteca livros",
  paperclip: "clipe anexo", bookmark: "marcador favorito", tag: "etiqueta rotulo tag", flag: "bandeira marcar",
  layers: "camadas", package: "pacote caixa entrega", box: "caixa", boxes: "caixas", container: "colunas grade",
  quote: "citacao aspas", list: "lista", checklist: "checklist tarefas feito", numberedList: "lista numerada",
  table: "tabela grade dados", kanban: "kanban quadro", grid: "grade", dashboard: "painel dashboard",
  rocket: "foguete lancamento startup", sparkles: "brilho destaque novo magia", zap: "raio rapido energia",
  star: "estrela favorito avaliacao", award: "premio medalha", trophy: "trofeu vitoria premio",
  medal: "medalha premio", crown: "coroa premium vip", gem: "joia gema premium", diamond: "diamante premium",
  flame: "chama fogo quente popular", heart: "coracao curtir amor", thumbsUp: "joinha curtir gostei bom",
  thumbsDown: "descurtir ruim negativo", target: "alvo meta objetivo", gauge: "medidor velocidade desempenho",
  trending: "tendencia subir crescimento alta", trendingDown: "tendencia cair queda baixa",
  percent: "porcentagem desconto", chart: "grafico pizza", barChart: "grafico barras", lineChart: "grafico linha",
  megaphone: "megafone anuncio aviso marketing", party: "festa comemoracao confete", ticket: "ingresso cupom bilhete",
  scale: "balanca justica peso",
  info: "informacao ajuda", help: "ajuda duvida pergunta", lightbulb: "ideia dica lampada", alert: "alerta atencao aviso perigo",
  alertCircle: "alerta erro atencao", alertOctagon: "alerta parar erro", check: "certo ok concluido sucesso feito",
  checkCheck: "duplo certo confirmado", badge: "selo verificado", bell: "sino notificacao aviso",
  bellRing: "sino tocando alerta", eye: "olho ver visualizar", eyeOff: "ocultar esconder invisivel",
  search: "buscar procurar lupa pesquisa", filter: "filtro filtrar", ban: "proibido bloquear cancelar remover",
  loader: "carregando spinner", refresh: "atualizar recarregar sincronizar", history: "historico recente",
  hourglass: "ampulheta tempo espera",
  settings: "configuracoes ajustes opcoes engrenagem", settings2: "configuracoes ajustes", cog: "engrenagem configuracao",
  sliders: "controles ajustes filtros", wrench: "chave ferramenta manutencao", terminal: "terminal console comando",
  code: "codigo programacao dev", braces: "chaves codigo json", binary: "binario dados",
  database: "banco de dados dados", server: "servidor hospedagem", hardDrive: "disco armazenamento hd",
  cpu: "processador chip", plug: "tomada conectar integracao", power: "energia ligar desligar",
  cloud: "nuvem cloud", monitor: "monitor tela computador", laptop: "notebook computador", tablet: "tablet",
  smartphone: "celular telefone", mouse: "mouse", keyboard: "teclado", command: "comando atalho",
  printer: "impressora imprimir", network: "rede conexao", wifi: "wifi internet rede", bluetooth: "bluetooth",
  usb: "usb pendrive", webhook: "webhook integracao api", gitBranch: "git branch versao", gitCommit: "git commit versao",
  bug: "bug erro inseto", puzzle: "quebra-cabeca peca extensao plugin", workflow: "fluxo processo diagrama",
  toggle: "interruptor ligar", scan: "escanear digitalizar",
  shield: "escudo seguranca protecao", shieldCheck: "seguranca verificado protegido", shieldAlert: "seguranca alerta risco",
  lock: "cadeado bloqueado privado seguranca", lockKeyhole: "cadeado fechadura", unlock: "desbloquear aberto",
  key: "chave acesso senha", keyRound: "chave acesso", fingerprint: "digital biometria", scanFace: "rosto biometria facial",
  users: "usuarios pessoas equipe time", users2: "pessoas grupo", user: "usuario pessoa perfil",
  userPlus: "adicionar usuario convidar", userCheck: "usuario aprovado verificado", contact: "contato agenda",
  message: "mensagem chat conversa", messageCircle: "mensagem chat", messages: "mensagens conversas chat",
  mail: "email correio", mailOpen: "email aberto lido", phone: "telefone contato", phoneCall: "ligacao chamada",
  send: "enviar", reply: "responder", share: "compartilhar", atSign: "arroba email mencao", hash: "hashtag cerquilha",
  handshake: "aperto de mao parceria acordo", handHeart: "cuidado apoio doacao", handHelping: "ajuda apoio suporte",
  smile: "sorriso feliz emoji", speech: "fala discurso", voicemail: "correio de voz", graduation: "formatura educacao curso",
  home: "casa inicio home", building: "predio empresa escritorio", briefcase: "maleta trabalho negocio",
  store: "loja mercado", factory: "fabrica industria", hotel: "hotel hospedagem", hospital: "hospital saude",
  school: "escola educacao", landmark: "banco monumento instituicao", tent: "barraca acampamento evento",
  mountain: "montanha", treePine: "arvore pinheiro natureza", trees: "arvores floresta natureza",
  globe: "globo mundo internacional web", mapPin: "local pino mapa endereco", mapPinned: "local fixado mapa",
  map: "mapa", navigation: "navegacao direcao gps", milestone: "marco etapa", compass: "bussola direcao",
  anchor: "ancora naval fixo", footprints: "pegadas passos", truck: "caminhao entrega frete", plane: "aviao viagem voo",
  car: "carro automovel", bus: "onibus transporte", train: "trem", ship: "navio barco", bike: "bicicleta bike",
  fuel: "combustivel gasolina posto",
  calendar: "calendario data agenda", calendarDays: "calendario dias agenda", calendarCheck: "calendario confirmado",
  calendarClock: "calendario horario agendar", clock: "relogio hora tempo", alarm: "despertador alarme",
  watch: "relogio pulso", timer: "cronometro tempo", sun: "sol dia claro", sunrise: "nascer do sol manha",
  sunset: "por do sol tarde", moon: "lua noite escuro", cloudRain: "chuva nuvem", cloudSnow: "neve nuvem",
  cloudy: "nublado nuvem", wind: "vento", snowflake: "floco neve frio", droplet: "gota agua", umbrella: "guarda-chuva",
  cart: "carrinho compras", bag: "sacola compras", basket: "cesta compras", card: "cartao credito pagamento",
  wallet: "carteira dinheiro", gift: "presente brinde", receipt: "recibo nota fiscal comprovante",
  dollar: "dolar dinheiro preco", euro: "euro dinheiro", banknote: "cedula dinheiro nota", coins: "moedas dinheiro",
  piggy: "cofrinho poupanca economia", calculator: "calculadora conta", badgePercent: "desconto promocao selo",
  badgeDollar: "preco valor selo", qr: "qr code codigo",
  image: "imagem foto figura", imagePlus: "adicionar imagem foto", video: "video filme", film: "filme cinema video",
  camera: "camera foto", play: "reproduzir tocar play", music: "musica audio nota", mic: "microfone gravar audio",
  headphones: "fone ouvido audio", speaker: "alto-falante som", volume: "volume som audio", radio: "radio",
  podcast: "podcast audio", tv: "televisao tv", palette: "paleta cores design", brush: "pincel pintar design",
  penTool: "caneta vetor design", pencil: "lapis editar escrever", highlighter: "marca-texto grifar",
  crop: "cortar recortar imagem", scissors: "tesoura cortar", eraser: "borracha apagar", type: "texto fonte tipografia",
  bold: "negrito texto", aperture: "abertura foto lente", feather: "pena escrever leve", download: "baixar download",
  upload: "enviar upload", link: "link url ligacao", externalLink: "link externo abrir", rss: "rss feed assinar", trash: "lixeira excluir apagar",
  leaf: "folha natureza eco", flower: "flor natureza", sprout: "broto muda crescimento eco", bird: "passaro ave",
  paw: "pata animal pet", coffee: "cafe bebida pausa", apple: "maca fruta saude", wine: "vinho bebida",
  cake: "bolo festa aniversario", pizza: "pizza comida", cookie: "biscoito cookie", utensils: "talheres restaurante comida",
  heartPulse: "batimento saude coracao", stethoscope: "estetoscopio medico saude", pill: "remedio pilula saude",
  cross: "cruz saude hospital", dumbbell: "haltere academia exercicio", bed: "cama descanso hotel sono",
  ruler: "regua medida", magnet: "ima atrair", flashlight: "lanterna luz", lamp: "abajur luz lampada",
  battery: "bateria energia carga", recycle: "reciclar reciclagem eco", flask: "frasco laboratorio experimento quimica",
  gamepad: "controle jogo game", ear: "ouvido escutar audio", pin: "pino fixar alfinete", plus: "mais adicionar novo",
  dot: "ponto marcador", infinity: "infinito ilimitado", repeat: "repetir loop", shuffle: "aleatorio embaralhar",
  arrowRight: "seta direita proximo avancar", arrowLeft: "seta esquerda voltar anterior", arrowUp: "seta cima subir",
  arrowDown: "seta baixo descer", chevronRight: "seta avancar expandir",
};

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
