// ==========================================
// F1 賽事完整座標與賽道資料
// id: 呼叫用ID
// country: 地圖顯示名稱
// top:  left: 地圖座標
// date: 比賽日期
// desc: 內容介紹
// img: 顯示圖片
// link: 產品連結
// ==========================================
const f1Calendar2026 = [
  {
    id: "chn",
    country: "CHINA",
    top: 46,
    left: 80,
    title: "上海大獎賽",
    date: "MARCH 13 - 15",
    desc: "上海F1國際賽車場位於嘉定區，是舉辦F1中國大獎賽的專用場地。賽道設計呈「上」字形，象徵力爭上游，總長5.451公里，以複雜彎道和1.2公里長直道著稱，時速可達327公里/小時，充滿挑戰性。該賽場於2004年啟用，是亞洲頂級賽車場之一。",
    img: "https://image.tristar.com.tw/Picture/NewTristar/102038/640/1575884706_ec0fe8a13e_h.jpeg",
    link: "https://www.tristar.com.tw/grouptour/Detail/index/50"
  },
  {
    id: "jpn",
    country: "JAPAN",
    top: 44,
    left: 84.5,
    title: "日本大獎賽",
    date: "MARCH 27 - 29",
    desc: "結合名古屋周邊體驗之 F1 旅遊行程，感受鈴鹿賽道的極速震撼。",
    img: "https://image.tristar.com.tw/Picture/NewTristar/102038/015/1575885293_17bfce7886_h.jpeg",
    link: "https://www.tristar.com.tw/grouptour/Detail/index/104"
  },
  {
    id: "sgp",
    country: "SINGAPORE",
    top: 63.5,
    left: 75.1,
    title: "新加坡大獎賽",
    date: "OCTOBER 09 - 11",
    desc: "璀璨的濱海灣夜間市街賽事，享受無與倫比的城市光影與速度感。",
    img: "https://image.tristar.com.tw/Picture/NewTristar/91825/733/1741336084_a766761809_h.jpeg",
    link: "https://www.tristar.com.tw/grouptour/Detail/index/291"
  },
  {
    id: "hun",
    country: "HUNGARY",
    top: 35,
    left: 52.5,
    title: "匈牙利大獎賽",
    date: "JULY 24 - 26",
    desc: "此賽道以緊湊多彎的設計聞名，彎道數量多且連貫，對車手操控技術要求極高。由於缺乏長直道及超車點，加上高溫和塵土飛揚的環境，被稱為「F1中的卡丁車賽道」。",
    img: "https://image.tristar.com.tw/Picture/NewTristar/101183/386/1726105399_8fce4ddfcb_h.jpeg",
    link: "https://www.tristar.com.tw/grouptour/Detail/index/537"
  },
  {
    id: "mco",
    country: "MONACO",
    top: 38.5,
    left: 48.5,
    title: "摩納哥大獎賽",
    date: "JUNE 05 - 07",
    desc: "摩納哥大獎賽是一級方程式賽車每年在蒙特卡洛的摩納哥賽道舉行的比賽。從1929年開跑以來被大眾認為是最重要及最負盛名的汽車賽事，優美的風景和刺激的賽事讓摩納哥大獎賽有「一級方程式皇冠之上的明珠」的稱號。",
    img: "https://image.tristar.com.tw/Picture/NewTristar/101183/540/1726108674_f86129b5cc_h.webp",
    link: "https://www.tristar.com.tw/grouptour/Detail/index/536"
  },
  {
    id: "ita",
    country: "ITALIAN",
    top: 37,
    left: 50,
    title: "義大利大獎賽",
    date: "SEPTEMBER 04 - 06",
    desc: "義大利大獎賽在歷史悠久的蒙札賽道（Monza）舉行，這裡被譽為F1的「速度殿堂」。賽道以超長直道與極致的高速彎角聞名，是全年賽曆中平均車速最高的一站。身為法拉利的主場，每年賽事都會湧入無數熱情的紅軍車迷，現場氣氛堪稱F1之最。",
    img: "https://image.tristar.com.tw/Picture/NewTristar/102038/701/1575942765_fa72d12981_h.jpeg",
    link: "https://www.tristar.com.tw/grouptour/Detail/index/370"
  },
  {
    id: "uae",
    country: "UAE",
    top: 50,
    left: 62,
    title: "阿布達比大獎賽",
    date: "DECEMBER 04 - 06",
    desc: "阿布達比大獎賽在奢華的亞斯碼頭賽道（Yas Marina Circuit）舉行，通常作為F1賽季的最終收官戰。這是一場獨特的「從日暮過渡到黑夜」的暮光之戰。賽道穿梭於著名的亞斯總督酒店與豪華遊艇碼頭之間，結合了壯麗的夜景與頂級的高科技設施，為整個賽季畫下最華麗的句點。",
    img: "https://image.tristar.com.tw/Picture/NewTristar/102038/996/1575886348_1cbecf2c42_h.jpeg",
    link: "https://www.tristar.com.tw/grouptour/Detail/index/316"
  },
  {
    id: "aus",
    country: "AUSTRALIA",
    top: 87,
    left: 87,
    title: "澳洲大獎賽",
    date: "MARCH 19 - 21",
    desc: "澳洲大獎賽於墨爾本的阿爾伯特公園賽道（Albert Park Circuit）舉行，長年以來經常作為F1賽季的開幕戰。這是一條圍繞著優美湖泊的半市街賽道，擁有流暢的高速彎道與迷人的綠地景緻。現場氣氛宛如一場大型的賽車嘉年華，是全世界車迷與車手都非常喜愛的一站。",
    img: "https://image.tristar.com.tw/Picture/NewTristar/102038/320/1575941993_790a450ac8_h.jpeg",
    trackMap: "",
    link: "https://www.tristar.com.tw/grouptour/Detail/index/293"
  },{
    id: "usa-aus",
    country: "USA",
    top: 45,
    left: 20,
    title: "美國大獎賽",
    date: "OCTOBER 23 - 25",
    desc: "正統的美國大獎賽在德州奧斯汀的美洲賽道（COTA）舉行。這條賽道設計巧妙地融合了世界各地經典賽道的元素，最著名的標誌就是起跑後需直衝而上的「陡坡1號彎」，擁有極具挑戰性的巨大高低落差。結合濃厚的德州牛仔風情與嘉年華氣氛，這裡是美洲最受歡迎的F1賽事之一。",
    img: "https://image.tristar.com.tw/Picture/NewTristar/102038/214/1575886579_e1f816bcbe_h.jpeg",
    trackMap: "",
    link: "https://www.tristar.com.tw/grouptour/Detail/index/288"
  }
];