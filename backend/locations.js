// Auto-expansion map: city/country → sub-areas
// Add more cities as you grow

const EXPANSIONS = {
  // Nigeria
  "lagos": [
    "Lagos Island","Victoria Island Lagos","Lekki Lagos","Ikeja Lagos",
    "Surulere Lagos","Yaba Lagos","Ikoyi Lagos","Ajah Lagos","Festac Lagos",
    "Oshodi Lagos","Agege Lagos","Ojota Lagos","Maryland Lagos","Gbagada Lagos",
    "Magodo Lagos","Ogba Lagos","Isale Eko Lagos","Apapa Lagos","Mushin Lagos",
    "Alimosho Lagos","Ikorodu Lagos","Badagry Lagos","Epe Lagos","Ojo Lagos",
    "Ilupeju Lagos"
  ],
  "abuja": [
    "Wuse Abuja","Garki Abuja","Maitama Abuja","Asokoro Abuja","Gwarinpa Abuja",
    "Kubwa Abuja","Karu Abuja","Lugbe Abuja","Jabi Abuja","Area 1 Abuja",
    "Area 3 Abuja","Central Area Abuja","Utako Abuja","Gudu Abuja","Life Camp Abuja"
  ],
  "port harcourt": [
    "GRA Port Harcourt","Old GRA Port Harcourt","Rumuola Port Harcourt",
    "Rumuokoro Port Harcourt","Trans Amadi Port Harcourt","Eleme Port Harcourt",
    "Obio-Akpor Port Harcourt","Diobu Port Harcourt","Borokiri Port Harcourt"
  ],
  "kano": [
    "Sabon Gari Kano","Fagge Kano","Nassarawa Kano","Tarauni Kano",
    "Gwale Kano","Kano Municipal","Dala Kano","Ungogo Kano"
  ],
  "ibadan": [
    "Bodija Ibadan","Dugbe Ibadan","Ring Road Ibadan","Agodi Ibadan",
    "Challenge Ibadan","Iwo Road Ibadan","Ojoo Ibadan","Mokola Ibadan"
  ],
  "nigeria": [
    "Lagos Nigeria","Abuja Nigeria","Port Harcourt Nigeria","Kano Nigeria",
    "Ibadan Nigeria","Benin City Nigeria","Enugu Nigeria","Kaduna Nigeria",
    "Onitsha Nigeria","Warri Nigeria","Aba Nigeria","Jos Nigeria"
  ],

  // Ghana
  "accra": [
    "Osu Accra","Labone Accra","Airport Residential Accra","East Legon Accra",
    "Adabraka Accra","Dansoman Accra","Tema Accra","Kasoa Accra",
    "Spintex Accra","Cantonments Accra","Dzorwulu Accra","Roman Ridge Accra"
  ],
  "kumasi": [
    "Adum Kumasi","Asokwa Kumasi","Nhyiaeso Kumasi","Bantama Kumasi",
    "Suame Kumasi","Asawase Kumasi","Tafo Kumasi"
  ],
  "ghana": [
    "Accra Ghana","Kumasi Ghana","Tamale Ghana","Takoradi Ghana",
    "Cape Coast Ghana","Sunyani Ghana","Koforidua Ghana"
  ],

  // USA
  "texas": [
    "Austin Texas","Dallas Texas","Houston Texas","San Antonio Texas",
    "Fort Worth Texas","El Paso Texas","Arlington Texas","Plano Texas",
    "Lubbock Texas","Irving Texas","Corpus Christi Texas","Garland Texas"
  ],
  "california": [
    "Los Angeles California","San Francisco California","San Diego California",
    "Sacramento California","San Jose California","Oakland California",
    "Fresno California","Long Beach California","Bakersfield California"
  ],
  "florida": [
    "Miami Florida","Orlando Florida","Tampa Florida","Jacksonville Florida",
    "Fort Lauderdale Florida","St Petersburg Florida","Hialeah Florida",
    "Tallahassee Florida","Cape Coral Florida","Boca Raton Florida"
  ],
  "new york": [
    "Manhattan New York","Brooklyn New York","Queens New York","Bronx New York",
    "Staten Island New York","Harlem New York","Flushing New York",
    "Astoria New York","Williamsburg New York"
  ],
  "usa": [
    "New York USA","Los Angeles USA","Chicago USA","Houston USA",
    "Phoenix USA","Philadelphia USA","San Antonio USA","Dallas USA",
    "San Jose USA","Austin USA","Jacksonville USA","Miami USA"
  ],

  // UK
  "london": [
    "Central London","North London","South London","East London","West London",
    "Canary Wharf London","Shoreditch London","Brixton London","Camden London",
    "Hackney London","Islington London","Croydon London","Lewisham London"
  ],
  "uk": [
    "London UK","Manchester UK","Birmingham UK","Leeds UK","Glasgow UK",
    "Liverpool UK","Bristol UK","Sheffield UK","Edinburgh UK","Cardiff UK"
  ],

  // Canada
  "toronto": [
    "Downtown Toronto","North York Toronto","Scarborough Toronto","Etobicoke Toronto",
    "Mississauga Toronto","Brampton Toronto","Markham Toronto","Vaughan Toronto"
  ],
  "canada": [
    "Toronto Canada","Vancouver Canada","Montreal Canada","Calgary Canada",
    "Edmonton Canada","Ottawa Canada","Winnipeg Canada","Quebec City Canada"
  ],

  // Australia
  "sydney": [
    "CBD Sydney","North Sydney","Parramatta Sydney","Bondi Sydney",
    "Chatswood Sydney","Manly Sydney","Surry Hills Sydney","Newtown Sydney"
  ],
  "australia": [
    "Sydney Australia","Melbourne Australia","Brisbane Australia","Perth Australia",
    "Adelaide Australia","Gold Coast Australia","Newcastle Australia"
  ],

  // UAE
  "dubai": [
    "Downtown Dubai","Deira Dubai","Bur Dubai","Jumeirah Dubai",
    "Marina Dubai","Business Bay Dubai","Karama Dubai","Mirdif Dubai",
    "JLT Dubai","Silicon Oasis Dubai"
  ],
  "uae": [
    "Dubai UAE","Abu Dhabi UAE","Sharjah UAE","Ajman UAE","Ras Al Khaimah UAE"
  ],
};

/**
 * Expand a user's location string into multiple sub-area queries.
 * e.g. "restaurants" + "Lagos" → ["restaurants in Lagos Island", "restaurants in Lekki Lagos", ...]
 */
function expandQueries(keyword, location) {
  const loc = location.toLowerCase().trim();

  // Find best matching expansion key
  let areas = null;
  for (const key of Object.keys(EXPANSIONS)) {
    if (loc.includes(key)) {
      areas = EXPANSIONS[key];
      break;
    }
  }

  if (!areas) {
    // No expansion found — just use the original query
    return [`${keyword} in ${location}`];
  }

  return areas.map((area) => `${keyword} in ${area}`);
}

module.exports = { expandQueries };
