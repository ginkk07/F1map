/* =========================================================
   Singapore F1 Seat Data
   ---------------------------------------------------------
   只放看台資料，不處理 DOM、不綁事件。

   重點：
   1. ZONE_OPTIONS 是固定篩選選項。
      即使目前沒有 ZONE 3 座位，ZONE 3 按鈕仍然可以存在、可選、可取消。
   2. SEAT_DATA 只放目前實際要產生卡片與連動 SVG 的座位。
   3. ZONE_OPTIONS 的順序同時也是左側座位清單的 Zone 排序基準。
      目前預期排序為：ZONE 1 → PADDOCK ZONE → ZONE 2 → ZONE 3 → ZONE 4。
   4. CATEGORY_OPTIONS 是固定分類篩選選項。
      grandstand 代表一般看臺，hospitality 代表包廂 / 招待型票種。
   5. ZONE_COLOR 控制 SVG Zone 背景色。
      ZONE_SEAT_FILTER_COLOR 控制看臺 active 前，也就是可點擊但尚未選取時的顏色。
      ZONE_SEAT_ACTIVE_COLOR 控制看臺 active 後，也就是已選取時的顏色。
   6. mapIds 必須對應 singapore_f1_map.svg 裡面的 id。
      如果 SVG id 改名，這裡也要同步改。
   ========================================================= */

const DEFAULT_IMAGE = "./assets/images/photo_grandstand.png";

export const ZONE_OPTIONS = ["ZONE 1", "PADDOCK ZONE", "ZONE 2", "ZONE 3", "ZONE 4"];

export const CATEGORY_OPTIONS = ["grandstand", "hospitality"];

export const CATEGORY_LABEL = {
  grandstand: "一般看臺",
  hospitality: "包廂 / 招待"
};

// 控制 SVG 裡 #zone-1、#zone-2、#zone-3、#zone-4 的背景色。
export const ZONE_COLOR = {
  "ZONE 1": "#e07aff",
  "ZONE 2": "#ff9f1a",
  "ZONE 3": "#ff2d2d",
  "ZONE 4": "#2f80ed",
    "PADDOCK ZONE": "#ffba54"
};

// 控制地圖中「看臺」active 前的顏色。
// active 前 = 該看臺目前可點擊，但尚未被選取。
// 原則：使用比標籤色更淡的同色系，讓可點擊範圍清楚，但不搶過 active 狀態。
export const ZONE_SEAT_FILTER_COLOR = {
  "ZONE 1": "#fab7f5",
  "ZONE 2": "#ffba54",
  "ZONE 3": "#ff9a9a",
  "ZONE 4": "#9fc9ff",
  "PADDOCK ZONE": "#ebbe52"
};

// 控制地圖中「看臺」active 後的顏色。
// active 後 = 該看臺已被使用者點選。
// 原則：active 後顏色等同左側座位卡片的標籤顏色。
export const ZONE_SEAT_ACTIVE_COLOR = {
  "ZONE 1": "#dc4bfa",
  "ZONE 2": "#ff9f1a",
  "ZONE 3": "#ff2d2d",
  "ZONE 4": "#2f80ed",
  "PADDOCK ZONE": "#ff9d00"
};

// 保留舊名稱，避免其他檔案或測試程式仍引用 ZONE_SEAT_COLOR 時壞掉。
// 實際建議改用 ZONE_SEAT_FILTER_COLOR / ZONE_SEAT_ACTIVE_COLOR。
export const ZONE_SEAT_COLOR = ZONE_SEAT_FILTER_COLOR;

function getZoneSeatFilterColor(zone) {
  const normalizedZone = normalizeZone(zone);
  return ZONE_SEAT_FILTER_COLOR[normalizedZone] || ZONE_COLOR[normalizedZone] || "#e8ff1c";
}

function getZoneSeatActiveColor(zone) {
  const normalizedZone = normalizeZone(zone);
  return ZONE_SEAT_ACTIVE_COLOR[normalizedZone] || getZoneSeatFilterColor(normalizedZone);
}

function createSeat({
  id,
  title,
  category = "grandstand",
  zone,
  mapIds,
  description,
  color,
  activeColor,
  filterColor,
  image
}) {
  const normalizedZone = normalizeZone(zone);
  const normalizedCategory = normalizeCategory(category);

  // active 前：可點擊但尚未選取時使用。
  const seatFilterColor = filterColor || getZoneSeatFilterColor(normalizedZone);

  // active 後：已選取時使用。
  // color 保留作為 activeColor 的相容別名，避免既有 seat-map-view.js 需要一起改。
  const seatActiveColor = activeColor || color || getZoneSeatActiveColor(normalizedZone);

  return {
    id,
    title,
    category: normalizedCategory,
    zone: normalizedZone,

    // 已選取看臺使用的顏色。
    // 目前 seat-map-view.js 使用 seat.color 設定 --seat-color，所以保留 color。
    color: seatActiveColor,
    activeColor: seatActiveColor,

    // Zone / category 篩選後，可點擊但尚未選取的看臺顏色。
    // 預設同 Zone 共用同一色。
    filterColor: seatFilterColor,

    mapIds,
    // 有傳 image 就用該筆資料，沒傳才 fallback 預設圖
    image: image || DEFAULT_IMAGE,
    description
  };
}

export const SEAT_DATA = [
  /*
    注意：目前沒有 ZONE 3 的座位資料。
    ZONE 3 仍然會透過 ZONE_OPTIONS 顯示在篩選列中。
  */

  /** ZONE 4 **/
  createSeat({
    id: "padang-grandstand-a",
    title: "PADANG GRANDSTAND A",
    category: "grandstand",
    zone: "ZONE 4",
    mapIds: ["grandstand-padangA"],
    image: "./assets/images/grandstand_padangA.png",
    description: "位於 Padang 區域，靠近大型舞台、餐飲與活動區。觀眾可感受賽車高速通過城市街道的聲浪，同時方便參與演唱會與場內娛樂，適合重視整體活動體驗的觀眾。"
  }),

  createSeat({
    id: "padang-grandstand-b",
    title: "PADANG GRANDSTAND B",
    category: "grandstand",
    zone: "ZONE 4",
    mapIds: ["grandstand-padangB"],
    image: "./assets/images/grandstand_padangB.png",
    description: "同樣位於 Padang 區域，可欣賞 Turn 9 到 Turn 10 周邊賽道動態。此區最大特色是結合比賽、舞台演出與夜間節慶氣氛，適合想把 F1 當成完整娛樂活動體驗的旅客。"
  }),

  createSeat({
    id: "connaught-grandstand",
    title: "CONNAUGHT GRANDSTAND",
    category: "grandstand",
    zone: "ZONE 4",
    mapIds: ["grandstand-connaught"],
    image: "./assets/images/grandstand_connaught.png",
    description: "位於 Turn 14 附近，賽車通過橋面後進入重煞右彎，是可能出現超車嘗試與防守的位置。適合想看近距離煞車、入彎與輪對輪攻防的觀眾。"
  }),

  createSeat({
    id: "stamford-grandstand",
    title: "STAMFORD GRANDSTAND",
    category: "grandstand",
    zone: "ZONE 4",
    mapIds: ["grandstand-stamford"],
    image: "./assets/images/grandstand_stamford.png",
    description: "位於 Turn 7 到 Turn 8 之間，是 Zone 4 中較適合觀看重煞與超車嘗試的位置。賽車高速進彎後減速切入，再加速離開，能清楚看到車手攻防與路線選擇。"
  }),

  createSeat({
    id: "empress-grandstand",
    title: "EMPRESS GRANDSTAND",
    category: "grandstand",
    zone: "ZONE 4",
    mapIds: ["grandstand-empress"],
    image: "./assets/images/grandstand_empress.png",
    description: "位於 Turn 11 到 Turn 12 之間，周邊具有新加坡歷史街區與市政建築景觀。觀眾可看到賽車穿梭於狹窄街道與護牆之間，街道賽氛圍比一般看台更明顯。"
  }),

  /** ZONE 2 **/
  createSeat({
    id: "bayfront-grandstand",
    title: "BAYFRONT GRANDSTAND",
    category: "grandstand",
    zone: "ZONE 2",
    mapIds: ["bayfront-grandstand"],
    image: "./assets/images/grandstand_bayfront.png",
    description: "位於 Turn 17 附近，賽車會從高速路段大幅減速進入彎角，再重新加速通過濱海灣區域。這裡適合觀看重煞、入彎、出彎加速的完整動作變化。"
  }),

  createSeat({
    id: "skyline-grandstand",
    title: "SKYLINE GRANDSTAND",
    category: "grandstand",
    zone: "ZONE 2",
    mapIds: ["grandstand-skyline"],
    image: "./assets/images/grandstand_skyline.png",
    description: "位於賽道尾段、接近 Pit Lane 入口前方，可看到賽車通過最後幾個高壓彎角。視野結合濱海灣天際線與夜賽燈光，適合想要景觀感與速度感並重的觀眾。"
  }),

  createSeat({
    id: "promenade-grandstand",
    title: "PROMENADE GRANDSTAND",
    category: "grandstand",
    zone: "ZONE 2",
    mapIds: ["grandstand-promenade"],
    image: "./assets/images/grandstand_promenade.png",
    description: "位於 Turn 17 到 Turn 18 之間，背景鄰近 Singapore Flyer。觀眾可欣賞賽車在夜色與摩天輪景觀中高速通過，適合重視拍照畫面、城市夜景與賽道尾段氛圍的觀眾。"
  }),


  /** ZONE 1 **/
  createSeat({
    id: "turn-1-grandstand",
    title: "TURN 1 GRANDSTAND",
    category: "grandstand",
    zone: "ZONE 1",
    mapIds: ["grandstand-turn1"],
    image: "./assets/images/grandstand_turn1.png",
    description: "位於第一彎重煞車區，賽車從主直道高速衝出後進入 Turn 1，經常出現搶位、防守與起跑後的激烈攻防。適合想看超車嘗試、晚煞車與比賽開局混戰的觀眾。"
  }),

  createSeat({
    id: "turn-2-grandstand",
    title: "TURN 2 GRANDSTAND",
    category: "grandstand",
    zone: "ZONE 1",
    mapIds: ["grandstand-turn2"],
    image: "./assets/images/grandstand_turn2.png",
    description: "可俯瞰 Turn 1、Turn 2 與 Turn3 的連續彎角，觀察車手在起跑後如何搶線、修正路線並重新加速。相比 Turn 1 這裡能看到更完整的前段彎角節奏。"
  }),

  createSeat({
    id: "sky-suite-turn-1",
    title: "SKY SUITE TURN 1",
    category: "hospitality",
    zone: "ZONE 1",
    mapIds: ["sky-suite-turn1"],
    image: "./assets/images/hospitality_sky-suite.png",
    description: "Sky Suite Turn 1 位於第一彎區域，是結合高階招待服務與重煞攻防視角的頂級 Hospitality 票種。賓客可在全空調套房中享用精緻餐飲、香檳、葡萄酒、烈酒、啤酒與軟性飲品，並由專屬 Suite Ambassador 協助接待。專屬觀景區可欣賞賽車從主直道高速衝入 Turn 1 的瞬間，感受起跑後搶位、晚煞車與第一彎混戰的震撼。賽事期間亦可前往 Sky Terrace 欣賞賽道與新加坡天際線，並通行全區活動與 Padang Stage 演唱會。"
  }),

  createSeat({
    id: "sky-suite-turn-2",
    title: "SKY SUITE TURN 2",
    category: "hospitality",
    zone: "ZONE 1",
    mapIds: ["sky-suite-turn2"],
    image: "./assets/images/hospitality_sky-suite.png",
    description: "Sky Suite Turn 2 位於前段連續彎角區域，適合欣賞賽車通過 Turn 1、Turn 2 至 Turn 3 的完整攻防節奏。賓客可在全空調套房與私人觀景區中舒適觀賽，享用精緻餐飲、香檳、葡萄酒、烈酒、啤酒與軟性飲品，並由專屬 Suite Ambassador 提供接待服務。此區可觀察車手在起跑後如何搶線、防守、修正路線並重新加速，比單一彎角更能感受比賽前段的戰術變化。票券亦可通行全區活動、Padang Stage 演唱會與 Sky Terrace 屋頂景觀空間。"
  }),

  createSeat({
    id: "republic-grandstand",
    title: "REPUBLIC GRANDSTAND",
    category: "grandstand",
    zone: "ZONE 1",
    mapIds: ["grandstand-republic"],
    image: "./assets/images/grandstand_republic.png",
    description: "位於 Turn 5 右側視角，可看到賽車全油門穿越街道賽窄路後進入高速路段。畫面壓迫感強，能感受新加坡街道賽貼牆高速通過的精準度與臨場感。"
  }),

  createSeat({
    id: "raffles-grandstand",
    title: "RAFFLES GRANDSTAND",
    category: "grandstand",
    zone: "ZONE 1",
    mapIds: ["grandstand-raffles"],
    image: "./assets/images/grandstand_raffles.png",
    description: "位於 Turn 5 一帶，賽車通過中高速彎後準備進入後續直線與 DRS 區。這裡能欣賞車手如何維持速度、貼近護牆出彎，適合喜歡看技術路線與速度延伸感的觀眾。"
  }),

  createSeat({
    id: "chicane-turn-1-grandstand",
    title: "CHICANE @ TURN 1 GRANDSTAND",
    category: "grandstand",
    zone: "ZONE 1",
    mapIds: ["grandstand-chicane_x40_turn1"],
    image: "./assets/images/grandstand_chicane@turn1.png",
    description: "位於 Turn 1 內側，可觀看賽車從主直道高速進彎，並延伸觀察 Turn 1 至 Turn 3 的攻防，適合想看起跑後混戰的觀眾。"
  }),

  createSeat({
    id: "chicane-turn-2-grandstand",
    title: "CHICANE @ TURN 2 GRANDSTAND",
    category: "grandstand",
    zone: "ZONE 1",
    mapIds: ["grandstand-chicane_x40_turn2"],
    image: "./assets/images/grandstand_chicane@turn2.png",
    description: "位於 Turn 2 內側，可看到 Turn 1、Turn 2、Turn 3 的連續彎角動態，是觀察車手搶線、防守與出彎加速的重點位置。"
  }),
  
  createSeat({
    id: "pit-exit-grandstand",
    title: "PIT EXIT GRANDSTAND",
    category: "grandstand",
    zone: "ZONE 1",
    mapIds: ["grandstand-pit-exit"],
    image: "./assets/images/grandstand_pit-exit.png",
    description: "位於 Pit Exit 附近，可觀看賽車離開維修區後重新加入賽道，適合關注進站策略、輪胎更換後位置變化與賽道匯入動態。"
  }),

  createSeat({
    id: "lounge-turn-3",
    title: "LOUNGE @ TURN 3",
    category: "hospitality",
    zone: "ZONE 1",
    mapIds: ["lounge-turn31", "lounge-turn32"],
    image: "./assets/images/hospitality_lounge@turn3.png",
    description: "Lounge @ Turn 3 位於第一組彎角末端，是結合全空調招待空間與專屬 Turn 3 Premier Grandstand 的高階 Hospitality 票種。賓客可在 Lounge 中享用國際美食、輕食點心、葡萄酒、啤酒與軟性飲品，並透過現場轉播掌握賽道動態；想感受實際聲浪時，也可步行前往專屬戶外看臺，欣賞賽車在前段彎角爭奪位置後，煞入 Turn 3 再全油門衝向 Republic Boulevard 的畫面。此區提供較寬敞座椅、Executive restroom 與 Suite Ambassador 接待服務，兼具舒適度與臨場感。票券亦可通行全區活動與 Padang Stage 演唱會，並依現場名額體驗新加坡摩天輪。"
  }),

  createSeat({
    id: "the-green-room",
    title: "THE GREEN ROOM",
    category: "hospitality",
    zone: "ZONE 1",
    mapIds: ["lounge-turn3"],
    image: "./assets/images/hospitality_the-green-room.png",
    description: "The Green Room 位於 Turn 3 區域，是兼具舒適招待空間與近距離賽道視野的高階 Hospitality 票種。賓客可在全空調套房中放鬆觀賽，享用精心規劃的國際美食、香檳、葡萄酒、烈酒、啤酒與軟性飲品，也可前往專屬戶外看臺，近距離感受賽車通過前段彎角後，全油門衝向 Republic Boulevard 的速度與聲浪。相較一般看臺，The Green Room 更重視舒適度、餐飲服務與招待彈性，適合企業客戶、親友同行或想以輕鬆方式享受夜賽的旅客。票券亦可通行全區活動與 Padang Stage 演唱會，並依現場名額體驗新加坡摩天輪，完整結合賽道觀戰、美食酒水與濱海灣夜賽氛圍。"
  }),

  createSeat({
    id: "observatory-turn-3-5",
    title: "OBSERVATORY @ TURN 3",
    category: "hospitality",
    zone: "ZONE 1",
    mapIds: ["observ_x40_turn3.5"],
    image: "./assets/images/hospitality_Observ@3.png",
    description: "Observ@3 位於 Turn 3 後方，是結合雙層招待空間與賽道視野的高階 Hospitality 票種。賓客可從戶外觀景區或專屬賽道視角，欣賞賽車駛出 Turn 3 後全油門衝向 Republic Boulevard 的速度與聲浪；也可在全空調招待套房中享用國際美食、香檳、葡萄酒、烈酒、啤酒、軟性飲品與調酒吧服務。場內提供賽事現場轉播、Executive restroom 與專屬 Suite Ambassador 接待，並依現場名額體驗新加坡摩天輪，適合想兼具舒適招待、餐飲酒水與近距離賽道臨場感的旅客。"
  }),

  createSeat({
    id: "super-pit-grandstand",
    title: "SUPER PIT GRANDSTAND",
    category: "grandstand",
    zone: "ZONE 1",
    mapIds: ["grandstand-super-pit"],
    image: "./assets/images/grandstand_super-pit.png",
    description: "位於主直道上方高階席，正對 F1 車隊車庫、起跑線與終點線。可觀看車手起跑準備、維修區動態與衝線煙火，套票通常也包含餐飲、飲料與官方商品禮遇，適合想要完整主賽場體驗的觀眾。"
  }),

  createSeat({
    id: "sky-suite-pit-straight",
    title: "SKY SUITE PIT STRAIGHT",
    category: "hospitality",
    zone: "ZONE 1",
    mapIds: ["sky-suite-pit-straight"],
    image: "./assets/images/hospitality_sky-suite.png",
    description: "Sky Suite Pit Straight 位於主直道核心區域，是最能感受新加坡 F1 賽事主場氛圍的高階 Hospitality 票種之一。賓客可在全空調套房與私人觀景區中欣賞起跑、衝線、維修區動態與賽車高速通過主直道的震撼聲浪，並享用精緻餐飲、香檳、葡萄酒、烈酒、啤酒與軟性飲品。專屬 Suite Ambassador 將協助接待與服務安排，讓觀賽體驗更舒適完整。賽事期間亦可前往 Sky Terrace 屋頂空間，欣賞賽道、新加坡天際線與夜賽氛圍，並通行全區活動與 Padang Stage 演唱會。"
  }),

  createSeat({
    id: "formula-1-paddock-club",
    title: "FORMULA 1 PADDOCK CLUB™",
    category: "hospitality",
    zone: "PADDOCK ZONE",
    mapIds: ["stands-paddock"],
    image: "./assets/images/hospitality_paddock-club.png",
    description: "位於 Paddock Zone／Pit Straight 核心區，是新加坡 F1 最具代表性的頂級貴賓招待體驗。賓客可在舒適的空調套房中欣賞賽道動態，一邊享用精緻餐飲、名廚概念餐廳與高級飲品服務，一邊感受 F1 賽車從核心區域高速掠過的震撼聲浪。每日更可尊享 Pit Lane Walk，近距離觀看 F1 賽車、車隊車庫、維修區作業與工作人員準備過程，深入感受一般看臺難以接觸的賽事幕後氛圍。賽事期間亦可從多個觀景平台欣賞賽道盛況，並前往 Paddock Club™ 中庭或屋頂觀景台，飽覽濱海灣夜景與賽後煙火，完整體驗新加坡夜賽最頂級的一面。"
  }),

  createSeat({
    id: "pit-grandstand",
    title: "PIT GRANDSTAND",
    category: "grandstand",
    zone: "ZONE 1",
    mapIds: ["grandstand-pit"],
    image: "./assets/images/grandstand_pit.png",
    description: "位於主直道旁，是最具代表性的新加坡 F1 看台之一。觀眾可近距離欣賞起跑、衝線、維修區進出與頒獎前後氣氛，適合第一次觀賽或想感受完整大獎賽核心氛圍的旅客。"
  }),

  createSeat({
    id: "twenty3-turn-19",
    title: "TWENTY3 @ TURN 19",
    category: "hospitality",
    zone: "ZONE 1",
    mapIds: ["twenty3-turn19"],
    image: "./assets/images/hospitality_twenty3.png",
    description: "TWENTY3 位於 Turn 19 與終點區域附近，是結合賽道視野、餐飲、酒吧與娛樂氛圍的頂級招待型票種。賓客可從 Apex Lounge 屋頂欣賞濱海灣景色、頒獎台與終點線，感受賽車通過最後彎、衝向方格旗的關鍵時刻；亦可於多間特色餐廳中，一邊享用精緻餐飲與飲品，一邊近距離觀賞賽道尾段動態。賽事期間還可進入全區活動與 Padang Stage 演唱會，並依現場名額體驗新加坡摩天輪，完整感受新加坡夜賽結合速度、夜景、美食與娛樂的高端派對氛圍。"
  }),

  createSeat({
    id: "marina-bay-grandstand",
    title: "MARINA BAY GRANDSTAND",
    category: "grandstand",
    zone: "ZONE 1",
    mapIds: ["grandstand-marina-bay"],
    image: "./assets/images/grandstand_marina-bay.png",
    description: "靠近 Turn 18 與賽道尾段，可看到賽車進入最後幾個彎角前的路線控制。此區結合濱海灣夜景與賽道氛圍，適合想兼顧比賽畫面與新加坡城市景觀的觀眾。"
  }),

  /** 額外增加 **/
  createSeat({
    id: "the-vista-suite-singapore-flyer",
    title: "THE VISTA SUITE @ SINGAPORE FLYER",
    category: "hospitality",
    zone: "ZONE 2",
    mapIds: ["vista-suite_x26_Torque"],
    image: "./assets/images/hospitality_vista-suite.png",
    description: "位於 Singapore Flyer 2 樓、Turn 17 至 Turn 18 與 Pit Entry 一帶，是結合高空景觀、私人觀景陽台與精緻招待服務的 Hospitality 票種。賓客可在全空調套房中透過現場轉播掌握賽況，或前往專屬戶外陽台，欣賞賽車重煞進入最後彎、駛入維修區前的關鍵畫面。套票包含迎賓接待、晚餐、宵夜、國際美食，以及香檳、葡萄酒、烈酒、啤酒與軟性飲品；亦可使用 Flyer Hospitality 專屬看臺、酒吧與活動區，並享有新加坡摩天輪優先排隊體驗，適合重視視野、舒適度與完整夜賽氛圍的旅客。"
  }),

  createSeat({
    id: "torque-singapore-flyer",
    title: "TORQUE @ SINGAPORE FLYER",
    category: "hospitality",
    zone: "ZONE 2",
    mapIds: ["vista-suite_x26_Torque"],
    image: "./assets/images/hospitality_torque.png",
    description: "Torque @ Singapore Flyer 位於新加坡摩天輪地面層，是兼具空調休憩空間、美食酒水與賽道周邊活動氛圍的 Hospitality 票種。雖然室內 Lounge 本身不直接面向賽道，但賓客可透過現場轉播掌握比賽進行，並步行前往專屬賽道看臺與 Flyer Hospitality 活動區，近距離欣賞賽車在最後彎前重煞，或駛入 Pit Entry 的緊張畫面。套票包含迎賓接待、晚餐、宵夜、國際美食、葡萄酒、啤酒與軟性飲品，並設有專屬酒吧、DJ 與互動活動；亦可依現場名額體驗新加坡摩天輪，適合想兼顧餐飲、娛樂與賽道臨場感的觀眾。"
  }),

  createSeat({
    id: "lounge-plus-turn-3",
    title: "LOUNGE PLUS",
    category: "hospitality",
    zone: "ZONE 1",
    mapIds: ["lounge-plus"],
    image: "./assets/images/hospitality_lounge-plus.png",
    description: "Lounge Plus 位於 Turn 3，是比 Lounge @ Turn 3 更升級的高階 Hospitality 體驗。賓客可在裝潢更精緻的全空調 Lounge 中享用升級版國際美食，並享有更完整的飲品選擇，包含香檳、葡萄酒、烈酒、啤酒與軟性飲品。雖然 Lounge 本身不直接面向賽道，但附設戶外平台可感受現場氛圍，正式賽道觀戰則可前往 Turn 3 Premier Grandstand 專屬座位，近距離欣賞賽車通過前段彎角後，全油門衝向 Republic Boulevard 的畫面。場內提供賽事直播、專屬洗手間與 Suite Ambassador 接待服務，並可通行全區活動與 Padang Stage 演唱會。"
  }),

  createSeat({
    id: "drivers-right-lounge",
    title: "DRIVER'S RIGHT LOUNGE",
    category: "hospitality",
    zone: "ZONE 4",
    mapIds: ["drivers-right-lounge"],
    image: "./assets/images/hospitality_drivers-right-lounge.png",
    description: "Driver’s Right Lounge 位於 Esplanade 四樓，是 Zone 4 區域的高階 Hospitality 票種，結合濱海灣景觀、賽道視野與夜間娛樂氛圍。賓客可選擇在全空調室內 Lounge 放鬆觀賽，透過現場轉播掌握賽況，也可前往半開放戶外露台，從高處欣賞 Turn 14 至 Turn 16 一帶的賽道動態與賽車朝 Turn 16 前進的畫面。套票包含升級版國際美食，以及香檳、葡萄酒、烈酒、啤酒與軟性飲品，並提供專屬洗手間與 Suite Ambassador 接待服務。此區距離 Zone 4 Padang Stage 約 10 分鐘步行，適合想兼顧賽事、城市夜景、美食酒水與演唱會娛樂的旅客。"
  }),
];

const SEAT_SOURCE_INDEX = new Map(SEAT_DATA.map((seat, index) => [seat.id, index]));

function getZoneSortIndex(zone) {
  const index = ZONE_OPTIONS.indexOf(normalizeZone(zone));
  return index === -1 ? 999 : index;
}

function getCategorySortIndex(category) {
  const index = CATEGORY_OPTIONS.indexOf(normalizeCategory(category));
  return index === -1 ? 999 : index;
}

function getSeatSourceIndex(seatId) {
  return SEAT_SOURCE_INDEX.has(seatId) ? SEAT_SOURCE_INDEX.get(seatId) : 9999;
}

export function compareSeatsByDisplayOrder(a, b) {
  const zoneDiff = getZoneSortIndex(a.zone) - getZoneSortIndex(b.zone);

  if (zoneDiff !== 0) {
    return zoneDiff;
  }

  const categoryDiff = getCategorySortIndex(a.category) - getCategorySortIndex(b.category);

  if (categoryDiff !== 0) {
    return categoryDiff;
  }

  // 同一個 Zone、同一個 category 內保留 SEAT_DATA 原本的資料順序，避免看台內部排序被字母順序打亂。
  return getSeatSourceIndex(a.id) - getSeatSourceIndex(b.id);
}

export function getSeatDisplayList() {
  return [...SEAT_DATA].sort(compareSeatsByDisplayOrder);
}

export function getSeatDisplayListByCategories(categories) {
  const categorySet = new Set(
    Array.from(categories || CATEGORY_OPTIONS, normalizeCategory)
  );

  return getSeatDisplayList().filter((seat) => categorySet.has(seat.category));
}

export function getGrandstandSeatDisplayList() {
  return getSeatDisplayListByCategories(["grandstand"]);
}

export function getHospitalitySeatDisplayList() {
  return getSeatDisplayListByCategories(["hospitality"]);
}

export function getFilteredSeatDisplayList({ zones = ZONE_OPTIONS, categories = CATEGORY_OPTIONS } = {}) {
  const zoneSet = new Set(Array.from(zones, normalizeZone));
  const categorySet = new Set(Array.from(categories, normalizeCategory));

  return getSeatDisplayList().filter((seat) => {
    return zoneSet.has(seat.zone) && categorySet.has(seat.category);
  });
}

export function normalizeZone(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function normalizeCategory(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export function findSeatById(seatId) {
  return SEAT_DATA.find((seat) => seat.id === seatId) || null;
}
