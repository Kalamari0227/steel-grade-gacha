// Exact source sections extracted by prepare.mjs; no legacy UI/assets.
export function createLegacy({random=Math.random,now=Date.now,onSave=()=>{},onResult=()=>{}}={}){
const Math=Object.create(globalThis.Math); Math.random=random; const Date={now,UTC:globalThis.Date.UTC}; const GAME_EDITION={save:'steel_companion_prototype_20261109_v1'};
var FAMS = [
  { key:"poo", name:"포오", abbr:"PO", kind:"산세강판", pre:"JSH", std:"JFS A1001", c:"var(--po)",
    list:[
      {id:"poo-270C", code:"JSH270C", g:"CQ", w:100, t:"일반용", line:"때 벗으니까 좀 살 것 같네."},
      {id:"poo-270D", code:"JSH270D", g:"DQ", w:90, t:"드로잉용", line:"조금 더 눌러도 돼. 그 정도는 버텨."},
      {id:"poo-270E", code:"JSH270E", g:"DDQ", w:70, t:"심가공용", line:"깊게 들어가야 하는 자리? 나 불러."},
      {id:"poo-370W", code:"JSH370W", g:"370W", w:55, t:"고용강화", line:"이 급이 제일 많이 나가. 무난한 게 실력이야."},
      {id:"poo-440W", code:"JSH440W", g:"440W", w:45, t:"고용강화", line:"샤시 밑에서 받치는 건 대부분 나야."},
      {id:"poo-590Y", code:"JSH590Y", g:"590Y", w:22, t:"변태조직강", line:"처음엔 물러. 밀고 들어오면 그때부터 달라."},
      {id:"poo-780Y", code:"JSH780Y", g:"780Y", w:12, t:"변태조직강 · 최고 등급", line:"열연은 여기까지야. 더 위는 없어."},
      {id:"poo-PHS", code:"후열처리강", g:"PHS", w:1, t:"열처리 전 · 연질 상태", line:"지금 재 봐야 소용없어. 나는 아직 시작도 안 했어.",
       alt:{t:"열처리 후 · 1500MPa 이상", ts:"1500 이상", el:"5 ~ 7", line:"이제 알겠지. 불을 지나야 내가 되는 거야."}}
    ]},
  { key:"ssial", name:"씨알", abbr:"CR", kind:"냉연강판", pre:"JSC", std:"JFS A2001", c:"var(--cr)",
    list:[
      {id:"ssial-270C", code:"JSC270C", g:"CQ", w:100, t:"일반용", line:"여기서부턴 표면이 곧 성적이야."},
      {id:"ssial-270D", code:"JSC270D", g:"DQ", w:90, t:"드로잉용", line:"긁힘 하나에 반품이야. 살살 다뤄."},
      {id:"ssial-270E", code:"JSC270E", g:"DDQ", w:70, t:"심가공용", line:"도어 인너 정도는 눈 감고도 뽑아."},
      {id:"ssial-270F", code:"JSC270F", g:"EDDQ", w:48, t:"비시효 심가공", line:"시간이 지나도 항복점 연신 안 나와. 그게 내 값이야."},
      {id:"ssial-SEDDQ", code:"초심가공재", g:"S-EDDQ", w:34, t:"심가공 최상급 · 규격 외", line:"이 위로는 규격에 이름이 없어. 그래서 내가 기준이야."},
      {id:"ssial-340W", code:"JSC340W", g:"340W", w:62, t:"고용강화", line:"가벼워졌지? 두께를 줄인 거야."},
      {id:"ssial-340H", code:"JSC340H", g:"340H", w:40, t:"소부경화", line:"들어갈 땐 연해. 도장 굽고 나면 그때 세져."},
      {id:"ssial-440W", code:"JSC440W", g:"440W", w:45, t:"고용강화", line:"멤버, 레인포스. 안 보이는 데서 버티는 쪽이야."},
      {id:"ssial-590Y", code:"JSC590Y", g:"590Y", w:22, t:"변태조직강", line:"두 조직이 같이 있어. 하나로는 안 되는 일이거든."},
      {id:"ssial-780Y", code:"JSC780Y", g:"780Y", w:12, t:"변태조직강", line:"사이드실. 부딪히면 여기가 먼저 막아."},
      {id:"ssial-980Y", code:"JSC980Y", g:"980Y", w:6, t:"변태조직강", line:"이 위로는 만들 수 있는 데가 몇 없어."},
      {id:"ssial-1180Y", code:"JSC1180Y", g:"1180Y", w:3, t:"변태조직강", line:"여기까지 올 줄 알았어? 나도 몰랐어."},
      {id:"ssial-1470M", code:"1470 MART", g:"1470M", w:1.5, t:"마르텐사이트강", line:"냉간에서 1470까지. 대신 거의 안 굽어."},
    ]},
  { key:"ga", name:"도금이", abbr:"GA", kind:"합금화용융아연도금", pre:"JAC", std:"JFS A3011", c:"var(--ga)",
    list:[
      {id:"ga-270C", code:"JAC270C", g:"CQ", w:100, t:"일반용", line:"겉에 한 겹 더 있어. 웬만한 건 내가 먼저 맞아."},
      {id:"ga-270D", code:"JAC270D", g:"DQ", w:90, t:"드로잉용", line:"눌러도 돼. 도금은 안 벗겨져."},
      {id:"ga-270E", code:"JAC270E", g:"DDQ", w:70, t:"심가공용", line:"깊게 파도 층이 따라와. 그게 어려운 거야."},
      {id:"ga-270F", code:"JAC270F", g:"EDDQ", w:48, t:"비시효 심가공", line:"묵혀놔도 괜찮아. 급할 거 없잖아."},
      {id:"ga-SEDDQ", code:"초심가공재", g:"S-EDDQ", w:34, t:"심가공 최상급 · 규격 외", line:"도금 붙은 채로 여기까지 늘어나. 규격엔 안 적혀 있어."},
      {id:"ga-340W", code:"JAC340W", g:"340W", w:62, t:"고용강화", line:"도장이 잘 붙어. 그게 내가 하는 일이야."},
      {id:"ga-340H", code:"JAC340H", g:"340H", w:40, t:"소부경화", line:"성형은 순하게, 도장 지나면 단단하게. 순서가 있는 거야."},
      {id:"ga-440W", code:"JAC440W", g:"440W", w:45, t:"고용강화", line:"리벳 몇 개 더 박혔다고 달라진 건 없어. 좀 세졌을 뿐."},
      {id:"ga-590Y", code:"JAC590Y", g:"590Y", w:22, t:"변태조직강", line:"속에 단단한 게 섞여 있어. 겉만 보면 몰라."},
      {id:"ga-780Y", code:"JAC780Y", g:"780Y", w:12, t:"변태조직강", line:"용접할 때 조심해. 나 이제 좀 예민하거든."},
      {id:"ga-980Y", code:"JAC980Y", g:"980Y", w:6, t:"변태조직강", line:"이쯤 오면 도금하는 것도 일이야."},
      {id:"ga-1180Y", code:"JAC1180Y", g:"1180Y", w:3, t:"변태조직강", line:"끝까지 왔네. 나도 여기까진 안 와봤어."},
      {id:"ga-1470H", code:"Al-Si 핫프레스포밍", g:"1470H", w:1.2, t:"가열 전 · Al-Si 도금 상태", line:"겉에 알루미늄 실리콘 한 겹. 이게 있어야 노에서 안 타.",
       alt:{t:"프레스 후 · 1500MPa 이상", ts:"1500 이상", el:"5 ~ 7", line:"금형에서 식으면서 굳었어. 도금층은 그대로 붙어 있고."}}
    ]},
  { key:"eg", name:"이지", abbr:"EG", kind:"전기아연도금강판 · 편면", pre:"SECC", std:"JIS G3313", c:"var(--eg)",
    list:[
      {id:"eg-SECC", code:"SECC · E24/00", g:"편면도금", t:"연료탱크용 편면 전기아연도금", line:"밖은 도금, 안은 맨몸이야. 기름 닿는 쪽엔 아연을 안 쓰거든."}
    ]},
  { key:"tarae", name:"타래", abbr:"Wire Rod", sh:"WR", kind:"선재", pre:"SWR", std:"JIS 선재 · SAE", c:"var(--wr)",
    list:[
      {id:"wr-SWRM", code:"SWRM10", g:"연강", t:"연강 선재", line:"아직 뭐가 될지는 나도 몰라. 어디로든 구부러져."},
      {id:"wr-SWRY", code:"SWRY11", g:"용접봉", t:"용접봉 심선재", line:"내가 녹아야 둘이 붙어. 그게 내 일이야."},
      {id:"wr-SWRH", code:"SWRH72A", g:"경강", t:"경강 선재", line:"뽑을수록 세져. 다이를 지날 때마다."},
      {id:"wr-CORD", code:"SWRH82B", g:"타이어코드", t:"타이어코드용 고탄소", line:"머리카락보다 가늘게 뽑혀. 그러고도 안 끊어져."},
      {id:"wr-CHQ", code:"SCM435H", g:"CHQ", t:"냉간압조용 · 경화능 보증강", line:"머리를 맞아야 볼트가 돼. 속까지 단단해지는 건 그다음이고."},
      {id:"wr-SUJ", code:"SUJ2", g:"베어링강", t:"고탄소 크롬", line:"티 하나면 끝이야. 그래서 이렇게까지 깨끗해."},
      {id:"wr-SPR", code:"SAE 9254", g:"스프링강", t:"Si-Cr 스프링강", line:"눌러 봐. 그만큼 돌려줄게."},
      {id:"wr-VLV", code:"SAE 9254V", g:"밸브스프링", t:"엔진 밸브스프링용", line:"일 분에 삼천 번. 십 년을 그렇게 뛰어."},
      {id:"wr-NHT", code:"열처리생략형", g:"비조질", t:"비조질 냉간압조용", line:"열처리를 건너뛰어. 공정도 탄소도 같이 줄지."}
    ]},
  /* 히든 — 1470급 셋을 도감에 올려야 칸이 보이고, 뽑기로는 나오지 않습니다 */
  { key:"qp", name:"큐피", abbr:"QP", kind:"냉연 초고장력 · 선행개발", pre:"Q&P", std:"사내 선행개발", c:"var(--qp)",
    hidden:true,
    list:[
      {id:"qp-1470", code:"1470 QP", g:"1470QP", t:"담금질 · 분배 처리강 · 선행개발",
       line:"한 번 굳히고, 탄소를 한 번 더 나눴어. 그래서 세면서도 늘어나."}
    ]}
];

/* 등급별 대표 물성. 규격 보증치가 아니라 그 급에서 통상 나오는 값입니다. */
var GSPEC = {
  "CQ":     {ts:"270 이상", el:"36 이상"},
  "DQ":     {ts:"270 이상", el:"38 이상"},
  "DDQ":    {ts:"270 이상", el:"40 이상"},
  "EDDQ":   {ts:"270 이상", el:"42 이상"},
  "S-EDDQ": {ts:"270 이상", el:"44 이상"},
  "340W":   {ts:"340 이상", el:"34 이상"},
  "370W":   {ts:"370 이상", el:"32 이상"},
  "340H":   {ts:"340 이상", el:"34 이상"},
  "440W":   {ts:"440 이상", el:"27 이상"},
  "590Y":   {ts:"590 이상", el:"24 이상"},
  "780Y":   {ts:"780 이상", el:"15 이상"},
  "980Y":   {ts:"980 이상", el:"10 이상"},
  "1180Y":  {ts:"1180 이상", el:"7 이상"},
  "1470M":  {ts:"1470 이상", el:"4 이상"},
  "PHS":    {ts:"500 ~ 700", el:"20 내외"},

  /* 선재는 연신율을 쓰지 않습니다. 규격서가 보증하는 것은 단면수축률(RA)입니다. */
  "연강":       {ts:"350 ~ 450",   ra:"70 이상"},
  "용접봉":     {ts:"350 ~ 450",   ra:"70 이상"},
  "경강":       {ts:"1050 ~ 1200", ra:"35 이상"},
  "타이어코드": {ts:"1150 ~ 1300", ra:"30 이상"},
  "CHQ":        {ts:"600 내외",    ra:"60 이상"},
  "베어링강":   {ts:"600 ~ 700",   ra:"40 이상"},
  "스프링강":   {ts:"900 ~ 1100",  ra:"30 이상"},
  "밸브스프링": {ts:"1900 ~ 2100", ra:"40 이상"},
  "비조질":     {ts:"700 ~ 900",   ra:"45 이상"},

  /* 연료탱크용 편면 도금재. 소지는 심가공 연질재입니다. */
  "편면도금": {ts:"270 이상", el:"40 이상"},

  "1470H":  {ts:"500 ~ 700", el:"20 내외"},

  /* 같은 1470급인데 연신이 두 배를 넘습니다. 이 강을 개발하는 이유가 이 숫자입니다. */
  "1470QP": {ts:"1470 이상", el:"10 이상"}
};

/* 주로 나가는 자동차 부품. 같은 등급이라도 품종마다 다릅니다. */
var USE = {
  "poo-270C":"휠 디스크 · 일반 구조재", "poo-270D":"휠 림 · 브래킷",
  "poo-270E":"오일 팬 · 딥드로잉 부품", "poo-370W":"크로스 멤버 · 시트 프레임",
  "poo-440W":"샤시 멤버 · 로어 암", "poo-590Y":"서스펜션 암 · 휠 디스크",
  "poo-780Y":"로어 암 · 서브 프레임", "poo-PHS":"범퍼 빔 · 필러 보강",

  "ssial-270C":"브래킷 · 커버류", "ssial-270D":"도어 인너 · 휠 하우스",
  "ssial-270E":"쿼터 인너 · 오일 팬", "ssial-270F":"도어 아우터 · 펜더",
  "ssial-SEDDQ":"사이드 아우터 · 복잡 형상 외판", "ssial-340W":"외판 보강재 · 도어 인너",
  "ssial-340H":"후드 아우터 · 도어 아우터", "ssial-440W":"멤버 · 레인포스",
  "ssial-590Y":"B 필러 보강 · 사이드 멤버", "ssial-780Y":"사이드 실 · B 필러",
  "ssial-980Y":"B 필러 아우터 · 루프 레일", "ssial-1180Y":"사이드 실 이너 · 범퍼 빔",
  "ssial-1470M":"도어 임팩트 빔 · 범퍼 빔",

  "ga-270C":"플로어 · 커버류", "ga-270D":"도어 인너 · 휠 하우스",
  "ga-270E":"쿼터 인너 · 플로어 패널", "ga-270F":"도어 아우터 · 사이드 아우터",
  "ga-SEDDQ":"사이드 아우터 · 복잡 형상 외판", "ga-340W":"플로어 보강 · 도어 인너",
  "ga-340H":"후드 아우터 · 펜더", "ga-440W":"멤버 · 대시 패널",
  "ga-590Y":"사이드 멤버 · 크로스 멤버", "ga-780Y":"사이드 실 · 필러 보강",
  "ga-980Y":"B 필러 · 루프 레일", "ga-1180Y":"사이드 실 · 범퍼 빔 보강",
  "ga-1470H":"센터 필러 · 사이드 실 · 범퍼 빔",

  "wr-SWRM":"못 · 철선 · 철망 · 옷걸이",
  "wr-SWRY":"피복 아크 용접봉 심선", "wr-SWRH":"PC강선 · 와이어로프 · 스프링",
  "wr-CORD":"타이어 스틸코드 · 비드와이어", "wr-CHQ":"고장력 볼트 · 엔진 체결부",
  "wr-SUJ":"베어링 볼 · 롤러 · 궤도륜", "wr-SPR":"현가 스프링 · 스태빌라이저",
  "wr-VLV":"엔진 밸브 스프링", "wr-NHT":"열처리 생략 볼트 · 단조 부품",

  "eg-SECC":"연료탱크 · 필러넥",

  "qp-1470":"B 필러 · 사이드 실 · 루프 레일 (냉간 성형)"
};

/* ── 자동차 부품 ──────────────────────────────────
   가진 캐릭터를 조합해 만듭니다. 캐릭터는 사라지지 않습니다. 도감이 본체니까요.
   need의 칸 하나마다, 그 칸에 적힌 강종을 하나라도 가지고 있으면 채워집니다.
   서른다섯 개를 다 만들면 자동차 한 대가 됩니다.                            */
var IMG_PART = {
  "roof":"__C1__",    "hood":"__C2__",    "fender":"__C3__",  "sideo":"__C4__",
  "dooro":"__C5__",   "tire":"__C6__",    "trunkin":"__C7__", "trunko":"__C8__",
  "whouse":"__C9__",
  "floor":"__C10__",  "sill":"__C11__",   "bumper":"__C12__", "apillar":"__C13__",
  "bpillar":"__C14__","crossm":"__C15__", "impact":"__C16__", "rim":"__C17__",
  "disc":"__C18__",   "tank":"__C19__",   "seat":"__C20__",   "bearing":"__C21__",
  "spring":"__C22__", "vspring":"__C23__","bolt":"__C24__",   "tierod":"__C25__",
  "arm":"__C26__",    "clutch":"__C27__", "stabil":"__C28__", "bracket":"__C29__",
  "reinf":"__C30__",  "roofx":"__C31__",  "sidemem":"__C32__",
  "brake":"__C34__",  "crank":"__C35__",  "conrod":"__C36__"
};

var PARTS = [
  {no:1, key:"roof", name:"루프", grp:"바디",
   need:[{n:"심가공 외판재", any:["ssial-270E","ssial-270F","ga-270E","ga-270F"]}],
   note:"넓고 평평해서 조금만 틀려도 빛으로 드러납니다. 차 한 대에서 표면을 가장 크게 보여 주는 한 장입니다."},

  {no:2, key:"hood", name:"후드", grp:"바디",
   need:[{n:"소부경화 외판", any:["ssial-340H","ga-340H"]},
         {n:"심가공 인너", any:["ssial-270E","ssial-270F","ga-270E","ga-270F"]}],
   note:"바깥 판은 덴트에 버텨야 하고 안쪽 판은 깊게 눌러 넣어야 합니다. 성격이 반대인 두 장을 겹쳐 한 짝으로 만듭니다."},

  {no:3, key:"fender", name:"펜더", grp:"바디",
   need:[{n:"비시효 심가공재", any:["ga-270F","ssial-270F"]}],
   note:"곡률이 크고 사람 눈에 가장 가까이 닿는 자리입니다. 묵혀 두어도 항복점 연신이 되살아나지 않아야 합니다."},

  {no:4, key:"sideo", name:"사이드 아우터", grp:"바디",
   need:[{n:"초심가공재", any:["ssial-SEDDQ","ga-SEDDQ"]}],
   note:"차 옆면을 통째로 한 장에 찍습니다. 가장 깊고 복잡하게 늘어나는 판이라 규격에 이름이 없는 등급이 여기 들어갑니다."},

  {no:5, key:"dooro", name:"도어 아우터", grp:"바디",
   need:[{n:"소부경화 외판", any:["ssial-340H","ga-340H"]}],
   note:"연할 때 성형하고 도장 소부를 지나며 단단해집니다. 외판 덴트의 정답이 이 한 장입니다."},

  {no:6, key:"tire", name:"타이어", grp:"섀시 · 구동",
   need:[{n:"타이어코드", any:["wr-CORD"]}],
   note:"고무 안에 강선이 들어 있습니다. 머리카락보다 가늘게 뽑혀 층을 이루고, 그러고도 끊어지지 않아야 합니다."},

  {no:7, key:"trunkin", name:"트렁크 인너", grp:"바디",
   need:[{n:"드로잉 이상 연질재", any:["ssial-270D","ssial-270E","ga-270D","ga-270E"]}],
   note:"보이지 않는 안쪽 판입니다. 표면 등급은 낮춰도 되고 깊이만 나오면 됩니다."},

  {no:8, key:"trunko", name:"트렁크 아우터", grp:"바디",
   need:[{n:"비시효 심가공재", any:["ga-270F","ssial-270F"]},
         {n:"고용강화 보강", any:["ssial-340W","ga-340W"]}],
   note:"외판과 보강이 한 덩어리로 움직입니다. 여닫는 동안 처지지 않아야 합니다."},

  {no:9, key:"whouse", name:"휠하우스", grp:"바디",
   need:[{n:"도금 심가공재", any:["ga-270E","ga-270F"]}],
   note:"바퀴가 튀기는 물과 돌을 그대로 맞는 자리입니다. 깊게 늘어나면서 도금층이 따라와야 합니다."},

  {no:10, key:"floor", name:"플로어", grp:"바디",
   need:[{n:"도금 연질재", any:["ga-270C","ga-270D","ga-270E"]},
         {n:"도금 고용강화", any:["ga-340W","ga-440W"]}],
   note:"바닥은 늘 젖습니다. 그래서 도금이 먼저고, 넓은 면을 눌러 강성을 냅니다."},

  {no:11, key:"sill", name:"씰 사이드", grp:"프레임",
   need:[{n:"980급 이상 초고장력", any:["ssial-980Y","ga-980Y","ssial-1180Y","ga-1180Y"]}],
   note:"측면 충돌에서 제일 먼저 맞는 자리입니다. 여기가 버텨야 문이 열립니다."},

  {no:12, key:"bumper", name:"범퍼 빔", grp:"프레임",
   need:[{n:"1180급 이상", any:["ssial-1180Y","ga-1180Y","ssial-1470M","ga-1470H","poo-PHS"]}],
   note:"차 맨 앞에서 혼자 받아냅니다. 가장 높은 등급이 들어가는 몇 안 되는 부품입니다."},

  {no:13, key:"apillar", name:"A 필러", grp:"프레임",
   need:[{n:"핫프레스포밍 또는 980급 이상", any:["ga-1470H","ssial-980Y","ga-980Y","ssial-1180Y","ga-1180Y"]}],
   note:"앞유리 양옆을 세로로 붙잡습니다. 가늘어야 시야가 트이고, 가늘어진 만큼 강도로 메꿉니다."},

  {no:14, key:"bpillar", name:"B 필러", grp:"프레임",
   need:[{n:"핫스탬핑재", any:["poo-PHS","ga-1470H"]},
         {n:"980급 보강", any:["ssial-980Y","ga-980Y"]}],
   note:"불에 달궈 금형에서 식히며 굳힙니다. 성형과 열처리를 한 번에 끝내는 유일한 자리입니다."},

  {no:15, key:"crossm", name:"크로스멤버", grp:"프레임",
   need:[{n:"열연 고장력", any:["poo-440W","poo-590Y","poo-780Y"]}],
   note:"차 바닥을 가로질러 좌우를 묶습니다. 두껍게 쓰는 자리라 열연이 그대로 들어갑니다."},

  {no:16, key:"impact", name:"도어 임팩트 빔", grp:"프레임",
   need:[{n:"마르텐사이트강", any:["ssial-1470M"]}],
   note:"문 안에 가로로 누워 있는 막대 하나입니다. 거의 굽지 않는 대신 그만큼 세게 버팁니다."},

  {no:17, key:"rim", name:"휠 림", grp:"섀시 · 구동",
   need:[{n:"열연 고장력", any:["poo-370W","poo-440W","poo-590Y"]}],
   note:"띠를 둥글게 말아 끝을 맞대고 용접합니다. 공기압과 차 무게를 동시에 받으니 연질재로는 안 됩니다."},

  {no:18, key:"disc", name:"휠 디스크", grp:"섀시 · 구동",
   need:[{n:"열연 변태조직강", any:["poo-590Y","poo-780Y"]}],
   note:"차 무게를 바퀴로 내려보내는 원판입니다. 구멍을 뚫고 접어 세우는 자리라 강도와 성형을 같이 요구합니다."},

  {no:19, key:"tank", name:"연료탱크", grp:"섀시 · 구동",
   need:[{n:"편면 도금재", any:["eg-SECC"]}],
   note:"바깥만 도금하고 안쪽은 맨 강철로 둡니다. 기름이 닿는 면에는 아연을 쓰지 않기 때문입니다."},

  {no:20, key:"seat", name:"시트 프레임", grp:"프레임",
   need:[{n:"냉연 고장력", any:["ssial-440W","ssial-590Y","ssial-780Y"]},
         {n:"열연 고장력", any:["poo-370W","poo-440W","poo-590Y"]}],
   note:"사람을 붙잡아 두는 뼈대입니다. 냉연으로 모양을 내고 열연으로 밑을 받칩니다."},

  {no:21, key:"bearing", name:"자동차용 베어링", grp:"섀시 · 구동",
   need:[{n:"고탄소 크롬 베어링강", any:["wr-SUJ"]}],
   note:"개재물 하나가 수명을 끊습니다. 강도가 아니라 깨끗함으로 만드는 부품입니다."},

  {no:22, key:"spring", name:"서스펜션 스프링", grp:"섀시 · 구동",
   need:[{n:"Si-Cr 스프링강", any:["wr-SPR"]}],
   note:"눌린 만큼 돌려주고 원래 길이로 돌아옵니다. 표면 한 겹이 물러지면 거기서 부러집니다."},

  {no:23, key:"vspring", name:"엔진 밸브 스프링", grp:"섀시 · 구동",
   need:[{n:"밸브스프링용 청정강", any:["wr-VLV"]}],
   note:"분당 수천 번을 십 년 동안 뜁니다. 차에 들어가는 스프링 중 가장 가혹한 자리입니다."},

  {no:24, key:"bolt", name:"볼트 · 너트", grp:"섀시 · 구동",
   need:[{n:"냉간압조용 선재", any:["wr-CHQ","wr-NHT"]}],
   note:"머리를 때려 모양을 냅니다. 깎지 않고 눌러 만들기 때문에 소재가 무르되 속까지 단단해져야 합니다."},

  {no:25, key:"tierod", name:"스티어링 타이로드", grp:"섀시 · 구동",
   need:[{n:"경화능 보증강", any:["wr-CHQ"]}],
   note:"운전대를 돌린 만큼 바퀴가 돕니다. 중심부까지 경도가 들어가야 해서 조미니로 보증받습니다."},

  {no:26, key:"arm", name:"서스펜션 암", grp:"섀시 · 구동",
   need:[{n:"열연 변태조직강", any:["poo-590Y","poo-780Y"]}],
   note:"구멍을 뚫고 넓혀 플랜지를 세웁니다. 인장강도로는 안 잡히는 절단면 능력이 따로 필요합니다."},

  {no:27, key:"clutch", name:"클러치", grp:"섀시 · 구동",
   need:[{n:"열연 고장력", any:["poo-440W","poo-590Y","poo-780Y"]},
         {n:"냉연·도금 780급", any:["ssial-780Y","ga-780Y"]}],
   note:"밟았다 뗄 때마다 눌러 붙였다 떨어지기를 반복합니다. 달궈졌다 식기를 되풀이해도 형상이 틀어지지 않아야 합니다."},

  {no:28, key:"stabil", name:"스태빌라이저", grp:"섀시 · 구동",
   need:[{n:"후열처리강 또는 스프링강", any:["poo-PHS","wr-SPR"]}],
   note:"좌우 바퀴를 한 막대로 묶어 차가 기우는 것을 줄입니다. 비틀렸다 그대로 돌아와야 하니 스프링과 같은 소재를 씁니다."},

  {no:29, key:"bracket", name:"브라켓", grp:"바디",
   need:[{n:"일반용 연질재", any:["poo-270C","ssial-270C","ga-270C"]}],
   note:"차 한 대에 수백 개가 들어갑니다. 특별한 요구가 없어서 오히려 물량이 가장 큰 자리입니다."},

  {no:30, key:"reinf", name:"보강재", grp:"프레임",
   need:[{n:"440급 고용강화", any:["ssial-440W","ga-440W","poo-440W"]}],
   note:"혼자 서는 부품이 아니라 다른 판 뒤에 덧대는 판입니다. 얇게 가면서 강성을 되찾는 방법입니다."},

  {no:31, key:"roofx", name:"루프 크로스멤버", grp:"프레임",
   need:[{n:"590급 이상 변태조직강", any:["ga-590Y","ssial-590Y","ga-780Y","ssial-780Y"]}],
   note:"지붕을 가로질러 차 폭을 붙잡습니다. 뒤집혔을 때 지붕이 내려앉지 않게 하는 것도 이 막대입니다."},

  {no:32, key:"sidemem", name:"사이드 멤버", grp:"프레임",
   need:[{n:"도금 780급 이상", any:["ga-780Y","ga-980Y","ssial-780Y","ssial-980Y"]}],
   note:"앞뒤로 길게 뻗은 차의 등뼈입니다. 정면 충돌에서 접히는 순서까지 설계된 부품입니다."},

  {no:34, key:"brake", name:"브레이크 패드", grp:"섀시 · 구동",
   need:[{n:"백 플레이트용 열연재", any:["poo-270C","poo-270D","poo-270E"]}],
   note:"마찰재를 붙이는 뒤판이 강재입니다. 달궈졌다 식기를 반복해도 휘지 않아야 패드가 고르게 닿습니다."},

  {no:35, key:"crank", name:"크랭크샤프트", grp:"섀시 · 구동",
   need:[{n:"비조질 단조강", any:["wr-NHT"]}],
   note:"단조한 뒤 그대로 식혀 씁니다. 조질 열처리를 건너뛰고도 필요한 강도가 나오는 강종이라야 합니다."},

  {no:36, key:"conrod", name:"커넥팅 로드", grp:"섀시 · 구동",
   need:[{n:"비조질 단조강", any:["wr-NHT"]},
         {n:"체결용 경화능 보증강", any:["wr-CHQ"]}],
   note:"큰 끝을 일부러 쪼갠 뒤 볼트로 다시 물립니다. 깨끗하게 쪼개지는 성질과 그걸 붙잡는 볼트가 함께 필요합니다."}
];

/* ── 완성차 ───────────────────────────────────────
   부품을 다 만들면 여덟 대 중 한 대를 고릅니다. 한 번 고르면 바꿀 수 없습니다.
   같은 강종 세트로 여덟 차종이 나오는 건 실제 플랫폼 공용화 그대로입니다.
   회사 이름과 차 이름은 쓰지 않습니다. 대신 그 회사와 그 차를 가리키는
   말로 고르게 했습니다.                                                  */
var IMG_CAR = {
  t:"__V1__", h:"__V2__", n:"__V3__", m:"__V4__",
  s:"__V5__", z:"__V6__", b:"__V7__", d:"__V8__"
};

var CARS = [
  {key:"t", tag:"첫 글자", body:"대형 미니밴",
   maker:"세계에서 가장 많이 파는 회사",
   line:"그리스 문자의 첫 글자를 이름으로 삼은 큰 상자입니다. 천장이 높고 문이 옆으로 밀려 열립니다. 뒷자리가 앞자리보다 좋은 차예요."},

  {key:"h", tag:"합의", body:"중형 세단",
   maker:"두 바퀴와 엔진으로 시작한 회사",
   line:"이름 자체가 '뜻이 맞았다'는 말입니다. 낮게 눕고 길게 뻗어, 옆면을 한 장으로 뽑는 실력이 그대로 드러납니다."},

  {key:"n", tag:"공책", body:"소형 해치백",
   maker:"'해 뜨는 곳의 산업'을 이름으로 쓴 회사",
   line:"이름이 '적어 두는 종이'입니다. 작고 네모반듯한데, 엔진은 발전만 하고 바퀴는 모터가 돌립니다."},

  {key:"m", tag:"목적지", body:"3열 SUV",
   maker:"세 개의 마름모를 쓰는 회사",
   line:"이름이 곧 '도착할 곳'입니다. 세 줄을 다 채우고도 짐이 들어가야 하니 바닥과 멤버가 그만큼 길어집니다."},

  {key:"s", tag:"부지런한 놈", body:"경형 크로스오버",
   maker:"경차와 인도 시장으로 큰 회사",
   line:"이름이 '쉬지 않고 움직이는 사람'입니다. 정해진 규격 안에서 실내를 최대로 뽑아내는 게 전부인 차예요."},

  {key:"z", tag:"다섯 번째", body:"크로스오버 SUV",
   maker:"로터리 엔진을 끝까지 밀었던 회사",
   line:"알파벳 둘에 숫자 하나가 이름입니다. 사람이 말을 타듯 차를 탄다는 게 이 회사가 늘 하는 말이죠."},

  {key:"b", tag:"물려받은 것", body:"중형 세단",
   maker:"여섯 별을 상표로 쓰는 회사",
   line:"이름이 '유산'입니다. 엔진이 낮게 누워 있고 네 바퀴가 늘 함께 굴러갑니다."},

  {key:"d", tag:"접히는 지붕", body:"경형 로드스터",
   maker:"작은 차만 만드는, 가장 오래된 회사",
   line:"지붕이 접혀 트렁크로 들어갑니다. 두 자리뿐인 경차라, 지붕을 열고도 몸이 버티게 하는 일이 제일 어렵습니다."}
];
function findCar(k){
  for(var i=0;i<CARS.length;i++) if(CARS[i].key === k) return CARS[i];
  return null;
}


var IMG=Object.fromEntries(FAMS.flatMap(f=>f.list.map(c=>[c.id,true])));
var POOL = Object.keys(IMG).filter(function(k){ return IMG[k] && k !== "qp-1470"; });
var KEY = GAME_EDITION.save;

var S = { owned:{}, stock:{}, last:"", extra:0, quizDay:"", items:{}, orderDay:"", orderKey:"",
          scrap:0, pending:"", pullAt:0, quizAt:0, quizUsed:0, bell:false, belledAt:-1,
          backupAt:0, orderDone:0, promoSeen:"", promoDone:"", noticeSeen:"",
          parts:{}, cars:[], pullUsed:0, qpSeen:0 };
var SCRAP_LV3 = 5, SCRAP_LV4 = 10;
var PULL_MAX = 1;   /* 기본 뽑기는 24시간에 한 번 */
var QUIZ_MAX = 3;   /* 퀴즈로 얻을 수 있는 뽑기는 24시간에 세 번까지 */
var ORDER_MAX = 1;  /* 고객 요구는 하루 한 건 */

/* ── 기간 한정 프로모션 ─────────────────────────────
   기기 시계에 맡기면 시간대가 다른 사람마다 다른 24시간이 됩니다. 그래서
   한국시간 00시를 UTC로 못 박아 둡니다(KST = UTC+9). 창이 닫히면 코드를
   건드리지 않아도 저절로 평소대로 돌아갑니다.                          */
/* 행사를 순서대로 늘어놓습니다. 지금 걸린 것(또는 다음에 올 것)이 PROMO가 됩니다.
   앞 행사가 끝나는 순간 다음 행사로 넘어가므로, 이어 붙일 때는 from을 앞 행사의 to와 맞춥니다. */
var PROMOS = [
  {
    key:  "2026-09-27",
    from: Date.UTC(2026, 8, 26, 15, 0, 0),   /* 2026-09-27 00:00 KST */
    to:   Date.UTC(2026, 8, 30, 15, 0, 0),   /* 2026-10-01 00:00 KST */
    name: "POL 라인 집중 생산 기간",
    why:  "산세 라인이 풀로 돕니다. 포오가 평소보다 두 배로 나옵니다.",
    pick:  "poo",           /* 픽업 종족 */
    pickX: 2,               /* 그 종족의 출현 확률 배수 */
    pullMax: PULL_MAX,      /* 뽑기 몫은 평소대로 */
    quizMax: QUIZ_MAX,      /* 퀴즈도 평소대로 */
    orderMax: ORDER_MAX     /* 고객 요구도 그대로 */
  },
  {
    key:  "2026-10-01",
    from: Date.UTC(2026, 8, 30, 15, 0, 0),   /* 2026-10-01 00:00 KST — 포오가 끝나는 그 시각 */
    to:   Date.UTC(2026, 9, 4, 15, 0, 0),    /* 2026-10-05 00:00 KST */
    name: "선재 라인 집중 생산 기간",
    why:  "선재 압연 라인이 풀로 돕니다. 타래가 평소보다 두 배로 나옵니다.",
    pick:  "tarae",
    pickX: 2,
    pullMax: PULL_MAX,
    quizMax: QUIZ_MAX,
    orderMax: ORDER_MAX
  },
  {
    key:  "2026-10-09",
    from: Date.UTC(2026, 9, 8, 15, 0, 0),    /* 2026-10-09 00:00 KST — 한글날 */
    to:   Date.UTC(2026, 9, 11, 15, 0, 0),   /* 2026-10-12 00:00 KST */
    name: "한글날 연휴 특근",
    why:  "연휴 사흘 동안 공장이 쉬지 않습니다. 뽑기가 하루 두 번입니다.",
    pick:  "",
    pullMax: 2,             /* 뽑기 몫 1 → 2 */
    quizMax: QUIZ_MAX,
    orderMax: ORDER_MAX
  },
  {
    key:  "2026-10-15",
    from: Date.UTC(2026, 9, 14, 15, 0, 0),   /* 2026-10-15 00:00 KST */
    to:   Date.UTC(2026, 9, 18, 15, 0, 0),   /* 2026-10-19 00:00 KST */
    name: "CGL 라인 집중 생산 기간",
    why:  "용융아연도금 라인이 풀로 돕니다. 도금이가 평소보다 두 배로 나옵니다.",
    pick:  "ga",
    pickX: 2,
    pullMax: PULL_MAX,
    quizMax: QUIZ_MAX,
    orderMax: ORDER_MAX
  },
  {
    key:  "2026-10-22",
    from: Date.UTC(2026, 9, 21, 15, 0, 0),   /* 2026-10-22 00:00 KST */
    to:   Date.UTC(2026, 9, 25, 15, 0, 0),   /* 2026-10-26 00:00 KST */
    name: "품질 교육 주간",
    why:  "현장 품질 교육이 열립니다. 철강 퀴즈를 하루 다섯 번까지 풀 수 있습니다.",
    pick:  "",
    pullMax: PULL_MAX,
    quizMax: 5,             /* 퀴즈 몫 3 → 5 */
    orderMax: ORDER_MAX
  }
];
/* 아직 끝나지 않은 첫 행사. 다 끝났으면 마지막 행사(끝났다는 안내용). */
function curPromo(){
  var n = Date.now();
  for(var i=0;i<PROMOS.length;i++) if(n < PROMOS[i].to) return PROMOS[i];
  return PROMOS[PROMOS.length-1];
}
/* PROMO 바로 뒤에 붙어 시작하는 행사 — 진행 중 배너에 예고로 씁니다 */
function nextPromo(){
  var i = PROMOS.indexOf(PROMO), nx = PROMOS[i+1];
  return nx && nx.from === PROMO.to ? nx : null;
}
var PROMO = curPromo();
function promoOn(){ PROMO = curPromo(); var n = Date.now(); return n >= PROMO.from && n < PROMO.to; }
function promoSoon(){ PROMO = curPromo(); return Date.now() < PROMO.from; }
function promoLeft(){ return Math.max(0, PROMO.to - Date.now()); }
function promoIn(){ return Math.max(0, PROMO.from - Date.now()); }
/* 이 두 함수만 보고 판단합니다. 상수를 직접 쓰는 곳이 없어야 원복이 확실합니다. */
function pullMax(){ return promoOn() ? PROMO.pullMax : PULL_MAX; }
function quizMax(){ return promoOn() ? PROMO.quizMax : QUIZ_MAX; }
function orderMax(){ return promoOn() ? PROMO.orderMax : ORDER_MAX; }


var DAY = 24 * 60 * 60 * 1000;
function readyIn(at){ return Math.max(0, (at || 0) + DAY - Date.now()); }
/* 기본 뽑기도 퀴즈처럼 몫으로 셉니다. 첫 뽑기 시각부터 24시간이 한 판이고
   그 안에서 pullMax()번까지 씁니다. 증산 기간에는 그 몫이 늘어납니다. */
function pullWindowOpen(){ return !!S.pullAt && readyIn(S.pullAt) > 0; }
function pullBaseLeft(){
  return pullWindowOpen() ? Math.max(0, pullMax() - S.pullUsed) : pullMax();
}
function pullReady(){ return pullBaseLeft() > 0; }
/* 24시간이 지나 몫이 새로 채워진 순간. 알림은 이때만 울립니다. */
function pullRenewed(){ return !!S.pullAt && readyIn(S.pullAt) === 0; }
/* 퀴즈는 첫 정답 시각부터 24시간이 한 판. 그 안에서 세 번까지 받습니다. */
function quizWindowOpen(){ return S.quizAt && readyIn(S.quizAt) > 0; }
function quizLeft(){ return quizWindowOpen() ? Math.max(0, quizMax() - S.quizUsed) : quizMax(); }
function quizReady(){ return quizLeft() > 0; }
/* 하루 최대 = 기본 몫 + 퀴즈로 얻은 몫 */
function pullsLeft(){ return pullBaseLeft() + S.extra; }


function allChars(){ var a=[]; FAMS.forEach(function(f){ f.list.forEach(function(c){
  a.push(Object.assign({}, c, {fam:f})); }); }); return a; }
function findChar(id){ var r=null; allChars().forEach(function(c){ if(c.id===id) r=c; }); return r; }

/* ── 제품 등급 ────────────────────────────────────
   강종을 사업 관점으로 네 단계로 묶습니다. 뽑기 확률은 이 단계가 정하고,
   같은 등급 안에서는 고르게 나옵니다.                                */
var LVG = {
  1: ["CQ","DQ","DDQ","340W","370W",              "연강"],
  2: ["EDDQ","340H","440W","590Y","780Y",          "용접봉","경강","타이어코드"],
  3: ["S-EDDQ","980Y","1180Y","편면도금",          "CHQ","베어링강","스프링강"],
  4: ["1470M","1470H","PHS",                       "밸브스프링","비조질"],
  5: ["1470QP"]                 /* 히든. 뽑기 확률이 없고 개발로만 얻습니다 */
};
var LVNAME = {1:"일반제품", 2:"시장기반전략제품", 3:"기술기반전략제품", 4:"미래수요제품", 5:"선행개발제품"};
var LVRATE = {1:0.45, 2:0.35, 3:0.15, 4:0.05};

/* 같은 등급 안에서도 유난히 귀한 것들. 1이 기본이고 작을수록 덜 나옵니다.
   등급별 확률(LVRATE)은 건드리지 않으므로, 여기서 덜어낸 몫은 같은 등급의
   다른 카드로 갑니다.                                                   */
var RARE = {
  "poo-PHS":     0.5,   /* 후열처리강 */
  "ga-1470H":    0.5,   /* Al-Si 핫프레스포밍 */
  "ssial-1180Y": 0.5,   /* 냉연 1180 */
  "ga-1180Y":    0.5    /* 도금 1180 */
};
function rareOf(id){ return RARE[id] || 1; }

function lvOf(c){
  for(var k=5;k>=1;k--) if(LVG[k].indexOf(c.g) >= 0) return k;
  return 1;
}
/* 카드 왼쪽 위 구석에 붙는 제품 등급 표시 */
function lvBadge(c){
  var n = lvOf(c);
  return '<span class="lvb lv'+n+'"><b>LV'+n+'</b>'+LVNAME[n]+'</span>';
}
/* 등급별 대표 물성. 열처리 계열은 뒷면 값이 따로 있습니다. */
function specOf(c, alt){
  var g = GSPEC[c.g] || {ts:"—", el:"—"};
  if(alt && c.alt && c.alt.ts) return {ts:c.alt.ts, el:c.alt.el, ra:c.alt.ra};
  return g;
}
/* 판재는 연신율, 선재는 단면수축률. 두 번째 줄의 이름과 값이 같이 바뀝니다. */
function ductRow(sp){
  if(sp.ra) return {k:"단면수축률 RA", v:sp.ra};
  return {k:"연신율 EL", v:sp.el || "—"};
}

/* 등급을 먼저 뽑고 그 안에서 한 장 고릅니다.
   그림이 아직 없는 등급의 몫은 남은 등급이 나눠 갖습니다. */
function bucketize(ids){
  var b = {1:[],2:[],3:[],4:[]};
  ids.forEach(function(id){ var c = findChar(id); if(c) b[lvOf(c)].push(id); });
  return b;
}
function pickFrom(b){
  var avail = [], tot = 0, k, i, r;
  for(k=1;k<=4;k++) if(b[k].length){ avail.push(k); tot += LVRATE[k]; }
  if(!avail.length) return null;
  r = Math.random() * tot;
  for(i=0;i<avail.length-1;i++){
    r -= LVRATE[avail[i]];
    if(r <= 0) break;
  }
  return pickIn(b[avail[i]]);
}
/* ── 픽업 ─────────────────────────────────────────
   등급별 확률(LVRATE)은 그대로 두고, 등급 안에서 픽업 종족이 차지하던 몫만
   pickX배로 키웁니다. 등급 분포가 안 바뀌니 그 종족의 전체 출현 확률이
   정확히 pickX배가 됩니다. 가중치를 그냥 두 배로 하면 1.5배쯤밖에 안 됩니다. */
function pickFam(){ return promoOn() ? (PROMO.pick || "") : ""; }
function pickX(){ return PROMO.pickX || 2; }
function isPick(id){
  var f = pickFam(); if(!f) return false;
  var c = findChar(id);
  return !!c && c.fam.key === f;
}
function famName(key){
  for(var i=0;i<FAMS.length;i++) if(FAMS[i].key === key) return FAMS[i].name;
  return key;
}

/* 등급 안에서 한 장. 균등이 아니라 희소도를 얹어 고릅니다. */
function pickIn(list){
  var i, n = list.length, w = [], tot = 0;
  for(i=0;i<n;i++) w[i] = rareOf(list[i]);

  if(pickFam()){
    var sp = 0, so = 0, on = [];
    for(i=0;i<n;i++){ on[i] = isPick(list[i]); if(on[i]) sp += w[i]; else so += w[i]; }
    if(sp > 0 && so > 0){
      var s  = sp / (sp + so);                    /* 지금 몫 */
      var s2 = Math.min(0.95, s * pickX());       /* 키운 몫 — 한 등급을 다 먹지는 않게 */
      var kp = s2 / s, ko = (1 - s2) / (1 - s);
      for(i=0;i<n;i++) w[i] *= on[i] ? kp : ko;
    }
  }

  for(i=0;i<n;i++) tot += w[i];
  var r = Math.random() * tot;
  for(i=0;i<n-1;i++){ r -= w[i]; if(r <= 0) break; }
  return list[i];
}

function weightedPick(){ return pickFrom(bucketize(POOL)) || POOL[0]; }


var QP_ID  = "qp-1470";
var QP_KEY = ["ssial-1470M", "ga-1470H", "poo-PHS"];   /* 출현 조건이자 QP가 대신하는 강종 */
var QP_NEED = [
  {n:"마르텐사이트의 강도", any:["ssial-1470M"]},
  {n:"변태조직강의 연성",   any:["ssial-1180Y", "ga-1180Y"]}
];
var QP_SCRAP = 10;

function hasQP(){ return !!S.owned[QP_ID]; }
function qpRevealed(){
  for(var i=0;i<QP_KEY.length;i++) if(!S.owned[QP_KEY[i]]) return false;
  return true;
}
/* 이 칸을 QP가 대신 채울 수 있는가 — 후보에 1470급이 하나라도 있으면 */
function qpCovers(sl){
  if(!hasQP()) return false;
  for(var i=0;i<sl.any.length;i++) if(QP_KEY.indexOf(sl.any[i]) >= 0) return true;
  return false;
}

function stockOf(id){ return S.stock[id] || 0; }
function addStock(id, n){
  var v = stockOf(id) + (n || 1);
  if(v > 0) S.stock[id] = v; else delete S.stock[id];
}
function totalStock(){
  var n = 0, k;
  for(k in S.stock) if(S.stock.hasOwnProperty(k)) n += S.stock[k];
  return n;
}

/* 이 부품을 지금 만들 수 있으면, 실제로 헐어 쓸 카드 목록을 돌려줍니다.
   칸마다 재고가 넉넉한 쪽을, 같으면 등급이 낮은 쪽을 먼저 씁니다.
   귀한 카드를 아끼는 게 기본값이어야 하니까요.                          */
function partPlan(p, picks){
  var tmp = {}, out = [], i, j;
  for(i = 0; i < p.need.length; i++){
    var sl = p.need[i], got = null;
    /* 사람이 고른 게 있으면 그것부터. QP가 대신할 수 있는 칸이면 기본은 QP입니다. */
    var want = picks && picks[i], free = qpCovers(sl);
    if(want === QP_ID && free){
      got = QP_ID;
    } else if(want && sl.any.indexOf(want) >= 0 && stockOf(want) - (tmp[want] || 0) > 0){
      got = want;
    } else if(free){
      got = QP_ID;
    } else {
      for(j = 0; j < sl.any.length; j++){
        var id = sl.any[j], left = stockOf(id) - (tmp[id] || 0);
        if(left <= 0) continue;
        if(!got){ got = id; continue; }
        var cur = stockOf(got) - (tmp[got] || 0);
        if(left > cur || (left === cur && lvOf(findChar(id)) < lvOf(findChar(got)))) got = id;
      }
    }
    if(!got) return null;
    if(got !== QP_ID) tmp[got] = (tmp[got] || 0) + 1;   /* QP는 닳지 않습니다 */
    out.push(got);
  }
  return out;
}

function slotOk(sl){
  if(qpCovers(sl)) return true;
  for(var i=0;i<sl.any.length;i++) if(stockOf(sl.any[i]) > 0) return true;
  return false;
}
function partReady(p){ return !!partPlan(p); }

function sweepPending(){
  if(S.pending){ S.scrap++; S.pending=""; }
}


function single(){
  if(drawBusy() || !POOL.length || pullsLeft()<=0) return;
  sweepPending();
  if(pullReady()){
    if(!pullWindowOpen()){ S.pullAt = Date.now(); S.pullUsed = 0; }
    S.pullUsed++;
  } else S.extra--;
  var id = weightedPick();
  var isNew = !S.owned[id];
  S.owned[id] = true;
  addStock(id, 1);
  save();
  wasReady = pullRenewed();
  armBell();
  askPersist();      /* 사용자 동작 직후여야 허가가 잘 납니다 */
  showPull(id, isNew);
}
var SCRAP_TEN = 20, TEN_N = 10;
function tenReady(){ return S.scrap >= SCRAP_TEN && POOL.length > 0; }

function tenPull(){
  if(drawBusy() || !tenReady()) return;
  S.scrap -= SCRAP_TEN;
  var ids = [], i;
  for(i = 0; i < TEN_N; i++) ids.push(weightedPick());

  /* 열 장 안에 LV3 이상이 하나도 없으면 마지막 한 장을 바꿔 줍니다 */
  var hi = false;
  for(i = 0; i < ids.length; i++) if(lvOf(findChar(ids[i])) >= 3){ hi = true; break; }
  if(!hi){
    var up = POOL.filter(function(id){ return lvOf(findChar(id)) >= 3; });
    if(up.length) ids[TEN_N - 1] = pickIn(up);
  }

  var isNew = [];
  ids.forEach(function(id, k){
    isNew[k] = !S.owned[id];
    S.owned[id] = true;
    addStock(id, 1);
  });
  save();
  showTen(ids, isNew);
  refresh();
}


var wasReady=false; function drawBusy(){return false;} function armBell(){} function askPersist(){} function refresh(){} function save(){onSave(S);} function showPull(id,fresh){onResult([id],[fresh]);} function showTen(ids,fresh){onResult(ids,fresh);}
return {state:()=>S,setState:value=>{S=value;},single,ten:tenPull,pullsLeft,tenReady,allChars,findChar,lvOf,specOf,rareOf,partPlan,parts:PARTS,use:USE,pool:POOL,weightedPick,qpRevealed};
}
