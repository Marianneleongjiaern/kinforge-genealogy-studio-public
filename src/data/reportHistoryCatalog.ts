export type ContextRecord = { id: string; date: string; title: string; summary: string; region: string; citation: string; url: string };

// Original concise summaries of facts, verified against the linked institutional sources.
// This finite English-language selection is shipped locally, not fetched at runtime.
export const HISTORY_CATALOG = {
  version: "2026-09-23",
  license: "KinForge factual summaries; source publications retain their own rights. No source images or long quotations reproduced.",
  records: [
    { id: "us-declaration", date: "1776-07-04", title: "United States Declaration of Independence adopted", summary: "The Continental Congress adopted the Declaration of Independence.", region: "United States", citation: "US National Archives, Creating the Declaration: A Timeline, July 4, 1776.", url: "https://www.archives.gov/founding-docs/timeline" },
    { id: "transcontinental-railway", date: "1869-05-10", title: "First US transcontinental railroad completed", summary: "The railway connection was completed at Promontory Summit, Utah.", region: "United States", citation: "US National Park Service, Golden Spike National Historical Park Facts.", url: "https://www.nps.gov/gosp/learn/historyculture/golden-spike-national-historical-park-facts.htm" },
    { id: "un-founded", date: "1945-10-24", title: "United Nations established", summary: "The UN Charter entered into force, establishing the United Nations.", region: "World", citation: "United Nations, History of the United Nations.", url: "https://www.un.org/en/about-us/history-of-the-un" },
    { id: "udhr", date: "1948-12-10", title: "Universal Declaration of Human Rights adopted", summary: "The UN General Assembly adopted the Universal Declaration of Human Rights.", region: "World", citation: "United Nations, History of the Declaration.", url: "https://www.un.org/en/about-us/udhr/history-of-the-declaration" },
    { id: "singapore-independence", date: "1965-08-09", title: "Singapore proclaimed independent", summary: "The Proclamation of Singapore declared Singapore an independent and sovereign state.", region: "Singapore", citation: "National Archives of Singapore, Proclamation of Singapore, 1965.", url: "https://corporate.nas.gov.sg/discover-archives/media/proclamationofsingapore/" },
    { id: "apollo-11", date: "1969-07-20", title: "Apollo 11 lands on the Moon", summary: "Apollo 11 made the first crewed lunar landing.", region: "World", citation: "NASA, Apollo 11 Mission Overview.", url: "https://www.nasa.gov/history/apollo-11-mission-overview/" },
    { id: "smallpox-eradication", date: "1980-05-08", title: "Global eradication of smallpox declared", summary: "The World Health Assembly adopted the declaration of global smallpox eradication.", region: "World", citation: "World Health Organization, WHA33.3, 8 May 1980.", url: "https://www.who.int/publications/i/item/WHA33-3" },
    { id: "web-public-domain", date: "1993-04-30", title: "CERN releases Web software into the public domain", summary: "CERN made its World Wide Web software freely available in the public domain.", region: "World", citation: "CERN, The birth of the Web.", url: "https://home.cern/science/computing/the-birth-of-the-web/" }
  ] satisfies ContextRecord[]
};
