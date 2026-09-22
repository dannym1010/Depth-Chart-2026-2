import {
  Team,
  RosterPlayer,
  FormationBoard,
  DrillFolder,
  PracticePlan,
  PracticePeriod,
  PlaybookGuideTree,
  PlaybookGuideOrder,
  StaffCoach,
  ScheduleEvent,
  SeasonConfig,
  AttendanceRecord,
} from '../types';

export const DEFAULT_TEAMS: Team[] = [
  {
    id: 'team_10u',
    name: '10U Youth Tackle',
    ageGroup: '10U',
    season: '2026 Season',
    color: 'indigo',
    headCoachName: '',
    calendarUrl: 'http://ical-cdn.teamsnap.com/team_schedule/8a8fa840-7ecc-4756-8e56-cf0913c39beb.ics',
    notes: 'Official 10U tackle football division',
  },
  {
    id: 'team_9u',
    name: '9U Youth Tackle',
    ageGroup: '9U',
    season: '2026 Season',
    color: 'sky',
    headCoachName: '',
    notes: 'Official 9U youth tackle football division',
  },
  {
    id: 'team_12u',
    name: '12U Senior Tackle',
    ageGroup: '12U',
    season: '2026 Season',
    color: 'amber',
    headCoachName: '',
    notes: 'Senior youth tackle division',
  },
  {
    id: 'team_8u',
    name: '8U Rookie / Flag',
    ageGroup: '8U',
    season: '2026 Season',
    color: 'emerald',
    headCoachName: '',
    notes: 'Developmental rookie program',
  },
  {
    id: 'team_6u',
    name: '6U Flag Football',
    ageGroup: '6U',
    season: '2026 Season',
    color: 'purple',
    headCoachName: '',
    notes: 'Introductory flag division',
  },
];

export const MASTER_ROSTER: RosterPlayer[] = [
  {
    num: "2",
    firstName: "Mohammed",
    lastName: "Ibrahim",
    rosterName: "Ibrahim",
    teamId: "team_10u",
    primaryPosition: "RB",
    secondaryPosition: "CB",
    offensivePosition: "4 (RB)",
    defensivePosition: "LCB",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "4",
    firstName: "Vincent",
    lastName: "Cambigianis",
    rosterName: "Cambigianis",
    teamId: "team_10u",
    primaryPosition: "WR",
    secondaryPosition: "CB",
    offensivePosition: "X (WR)",
    defensivePosition: "RCB",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "6",
    firstName: "Andrew",
    lastName: "Henderson",
    rosterName: "Henderson",
    teamId: "team_10u",
    primaryPosition: "TE",
    secondaryPosition: "DE",
    offensivePosition: "Y1 (TE)",
    defensivePosition: "E9 (DE)",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "7",
    firstName: "Jayden",
    lastName: "Silva",
    rosterName: "Silva",
    teamId: "team_10u",
    primaryPosition: "RB",
    secondaryPosition: "OLB",
    offensivePosition: "4 (RB)",
    defensivePosition: "S (OLB)",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "8",
    firstName: "James",
    lastName: "Kilkenny",
    rosterName: "Kilkenny",
    teamId: "team_10u",
    primaryPosition: "WR",
    secondaryPosition: "FS",
    offensivePosition: "Z (WR)",
    defensivePosition: "FS",
    conditioningHours: 10.5,
    paddedHours: 12.0,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 0, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "10",
    firstName: "Luke",
    lastName: "Mancini",
    rosterName: "Mancini",
    teamId: "team_10u",
    primaryPosition: "QB",
    secondaryPosition: "FS",
    offensivePosition: "1 (QB)",
    defensivePosition: "FS",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    isCaptain: true,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "11",
    firstName: "Dorian",
    lastName: "Berish",
    rosterName: "Berish",
    teamId: "team_10u",
    primaryPosition: "WR",
    secondaryPosition: "CB",
    offensivePosition: "W (WR)",
    defensivePosition: "LCB",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "12",
    firstName: "Richard",
    lastName: "Barry",
    rosterName: "Barry",
    teamId: "team_10u",
    primaryPosition: "WR",
    secondaryPosition: "SS",
    offensivePosition: "X (WR)",
    defensivePosition: "R (OLB)",
    conditioningHours: 10.5,
    paddedHours: 12.0,
    weeklyHours: { "pre-1": 8, "pre-2": 7.5, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "13",
    firstName: "Landon",
    lastName: "Veto",
    rosterName: "Veto",
    teamId: "team_10u",
    primaryPosition: "RB",
    secondaryPosition: "MLB",
    offensivePosition: "4 (RB)",
    defensivePosition: "M (MLB)",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "15",
    firstName: "Henry",
    lastName: "Swansen",
    rosterName: "Swansen",
    teamId: "team_10u",
    primaryPosition: "TE",
    secondaryPosition: "DE",
    offensivePosition: "Y1 (TE)",
    defensivePosition: "E5 (DE)",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "17",
    firstName: "David",
    lastName: "Dicob",
    rosterName: "Dicob",
    teamId: "team_10u",
    primaryPosition: "OL",
    secondaryPosition: "DT",
    offensivePosition: "RG",
    defensivePosition: "T3 (DT)",
    conditioningHours: 10.5,
    paddedHours: 9.5,
    weeklyHours: { "pre-1": 8, "pre-2": 7.5, "pre-3": 2.0, "pre-4": 0, "1": 2.5 }
  },
  {
    num: "19",
    firstName: "Paul",
    lastName: "Nardella",
    rosterName: "Nardella",
    teamId: "team_10u",
    primaryPosition: "QB",
    secondaryPosition: "CB",
    offensivePosition: "1 (QB)",
    defensivePosition: "RCB",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "20",
    firstName: "Jack",
    lastName: "Furfaro",
    rosterName: "Furfaro",
    teamId: "team_10u",
    primaryPosition: "WR",
    secondaryPosition: "FS",
    offensivePosition: "Z (WR)",
    defensivePosition: "FS",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    isCaptain: true,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "21",
    firstName: "Nash",
    lastName: "Ward",
    rosterName: "Ward",
    teamId: "team_10u",
    primaryPosition: "RB",
    secondaryPosition: "OLB",
    offensivePosition: "4 (RB)",
    defensivePosition: "W (OLB)",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "22",
    firstName: "Jaxson",
    lastName: "Pestone",
    rosterName: "Pestone",
    teamId: "team_10u",
    primaryPosition: "WR",
    secondaryPosition: "CB",
    offensivePosition: "W (WR)",
    defensivePosition: "LCB",
    conditioningHours: 5.5,
    paddedHours: 0,
    weeklyHours: { "pre-1": 5.5, "pre-2": 0, "pre-3": 0, "pre-4": 0, "1": 0 }
  },
  {
    num: "27",
    firstName: "Sean",
    lastName: "Lacerra",
    rosterName: "Lacerra",
    teamId: "team_10u",
    primaryPosition: "RB",
    secondaryPosition: "MLB",
    offensivePosition: "4 (RB)",
    defensivePosition: "M (MLB)",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "33",
    firstName: "Michael",
    lastName: "Frascone",
    rosterName: "Frascone",
    teamId: "team_10u",
    primaryPosition: "TE",
    secondaryPosition: "DE",
    offensivePosition: "Y1 (TE)",
    defensivePosition: "E9 (DE)",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "34",
    firstName: "Eddie",
    lastName: "Flemming",
    rosterName: "Flemming",
    teamId: "team_10u",
    primaryPosition: "FB",
    secondaryPosition: "DT",
    offensivePosition: "4 (RB)",
    defensivePosition: "T1 (DT)",
    conditioningHours: 8.0,
    paddedHours: 11.5,
    weeklyHours: { "pre-1": 5.5, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 2.0 }
  },
  {
    num: "40",
    firstName: "Chris",
    lastName: "Sokol",
    rosterName: "Sokol",
    teamId: "team_10u",
    primaryPosition: "FB",
    secondaryPosition: "MLB",
    offensivePosition: "4 (RB)",
    defensivePosition: "W (OLB)",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "44",
    firstName: "Caden",
    lastName: "Jones",
    rosterName: "Jones",
    teamId: "team_10u",
    primaryPosition: "OL",
    secondaryPosition: "DT",
    offensivePosition: "RT",
    defensivePosition: "T3 (DT)",
    conditioningHours: 10.0,
    paddedHours: 2.5,
    weeklyHours: { "pre-1": 5.5, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 0 }
  },
  {
    num: "48",
    firstName: "Michael",
    lastName: "Sweeny",
    rosterName: "Sweeny",
    teamId: "team_10u",
    primaryPosition: "C",
    secondaryPosition: "DT",
    offensivePosition: "C",
    defensivePosition: "T1 (DT)",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "50",
    firstName: "Colin",
    lastName: "Convery",
    rosterName: "Convery",
    teamId: "team_10u",
    primaryPosition: "C",
    secondaryPosition: "DT",
    offensivePosition: "C",
    defensivePosition: "T1 (DT)",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    isCaptain: true,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "52",
    firstName: "John",
    lastName: "Piqueras",
    rosterName: "Piqueras",
    teamId: "team_10u",
    primaryPosition: "RG",
    secondaryPosition: "DT",
    offensivePosition: "RG",
    defensivePosition: "T3 (DT)",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "56",
    firstName: "Ryan",
    lastName: "Russell",
    rosterName: "Russell",
    teamId: "team_10u",
    primaryPosition: "LT",
    secondaryPosition: "DE",
    offensivePosition: "LT",
    defensivePosition: "E5 (DE)",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    isCaptain: true,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "66",
    firstName: "Luca",
    lastName: "Mucciacciaro",
    rosterName: "Mucciacciaro",
    teamId: "team_10u",
    primaryPosition: "LG",
    secondaryPosition: "DT",
    offensivePosition: "LG",
    defensivePosition: "T1 (DT)",
    conditioningHours: 10.5,
    paddedHours: 12.0,
    weeklyHours: { "pre-1": 8, "pre-2": 7.5, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  },
  {
    num: "99",
    firstName: "Conrad",
    lastName: "Crean",
    rosterName: "Crean",
    teamId: "team_10u",
    primaryPosition: "RT",
    secondaryPosition: "DT",
    offensivePosition: "RT",
    defensivePosition: "T3 (DT)",
    conditioningHours: 10.5,
    paddedHours: 14.5,
    weeklyHours: { "pre-1": 8, "pre-2": 10, "pre-3": 2.5, "pre-4": 0, "1": 4.5 }
  }
];

export const INITIAL_DEFAULT_FORMATIONS: FormationBoard[] = [
  {
    "name": "21 Offense",
    "rows": [
      {
        "positions": [
          null,
          {
            "id": "21-LT",
            "name": "LT"
          },
          {
            "id": "21-LG",
            "name": "LG"
          },
          {
            "id": "21-C",
            "name": "C"
          },
          {
            "id": "21-RG",
            "name": "RG"
          },
          {
            "id": "21-RT",
            "name": "RT"
          },
          {
            "id": "21-Y1",
            "name": "Y1"
          }
        ],
        "rowClass": "oline",
        "id": "row_21_ol",
        "label": "Offensive Line & TE (Y1)",
        "slotCount": 7
      },
      {
        "rowClass": "receivers",
        "slotCount": 7,
        "label": "Wideouts and QB (X, Z,1)",
        "id": "row_21_wr",
        "positions": [
          {
            "id": "21-X",
            "name": "X"
          },
          null,
          null,
          {
            "id": "21-1",
            "name": "1 (QB)"
          },
          null,
          null,
          {
            "id": "21-Z",
            "name": "Z"
          }
        ]
      },
      {
        "label": "Backfield ( 2 )",
        "slotCount": 7,
        "id": "row_21_bk",
        "rowClass": "backfield",
        "positions": [
          null,
          null,
          null,
          {
            "id": "21-2",
            "name": "2 (FB)"
          },
          null,
          null,
          null
        ]
      },
      {
        "id": "row_t8haslrig",
        "positions": [
          null,
          null,
          null,
          {
            "id": "21-3",
            "name": "3 (HB)"
          },
          null,
          null,
          null
        ],
        "label": "Backfield (3)",
        "slotCount": 7,
        "rowClass": "oline"
      }
    ],
    "unit": "offense",
    "collapsed": false,
    "id": "form_21",
    "subtitle": "2 RBs - 1 TE (Y1) - 2 WRs (X Left, Z Right)"
  },
  {
    "rows": [
      {
        "id": "row_1787860064353_0",
        "positions": [
          {
            "id": "form_1787860064353-X-1787860064353_0",
            "name": "Y2"
          },
          {
            "id": "form_1787860064353-LT-1787860064353_1",
            "name": "LT"
          },
          {
            "id": "form_1787860064353-LG-1787860064353_2",
            "name": "LG"
          },
          {
            "id": "form_1787860064353-C-1787860064353_3",
            "name": "C"
          },
          {
            "id": "form_1787860064353-RG-1787860064353_4",
            "name": "RG"
          },
          {
            "id": "form_1787860064353-RT-1787860064353_5",
            "name": "RT"
          },
          {
            "id": "form_1787860064353-Y1-1787860064353_6",
            "name": "Y1"
          }
        ],
        "label": "Offensive Line & TE (Y1)",
        "slotCount": 7
      },
      {
        "id": "row_1787860064353_1",
        "positions": [
          null,
          null,
          null,
          {
            "id": "form_1787860064353-1 (QB)-1787860064353_3",
            "name": "1 (QB)"
          },
          null,
          null,
          {
            "id": "form_1787860064353-Z-1787860064353_6",
            "name": "Z"
          }
        ],
        "label": "Wideouts (X, Z)",
        "slotCount": 7
      },
      {
        "positions": [
          null,
          null,
          null,
          {
            "id": "form_1787860064353-2 (FB)-1787860064354_3",
            "name": "2 (FB)"
          },
          null,
          null,
          null
        ],
        "label": "Backfield (1 - 2 - 3 Stack)",
        "id": "row_1787860064354_2",
        "slotCount": 7
      },
      {
        "positions": [
          null,
          null,
          null,
          {
            "id": "form_1787860064353-3 (HB)-1787860064354_3",
            "name": "3 (HB)"
          },
          null,
          null,
          null
        ],
        "id": "row_1787860064354_3",
        "slotCount": 7,
        "label": "New Level"
      }
    ],
    "unit": "offense",
    "collapsed": false,
    "name": "22 Offense",
    "id": "form_1787860064353"
  },
  {
    "name": "32 Offense",
    "unit": "offense",
    "id": "form_1787860077403",
    "rows": [
      {
        "slotCount": 7,
        "label": "Offensive Line & TE (Y1)",
        "positions": [
          {
            "id": "form_1787860077403-X-1787860077403_0",
            "name": "Y2"
          },
          {
            "id": "form_1787860077403-LT-1787860077403_1",
            "name": "LT"
          },
          {
            "id": "form_1787860077403-LG-1787860077403_2",
            "name": "LG"
          },
          {
            "id": "form_1787860077403-C-1787860077403_3",
            "name": "C"
          },
          {
            "id": "form_1787860077403-RG-1787860077403_4",
            "name": "RG"
          },
          {
            "id": "form_1787860077403-RT-1787860077403_5",
            "name": "RT"
          },
          {
            "id": "form_1787860077403-Y1-1787860077403_6",
            "name": "Y1"
          }
        ],
        "id": "row_1787860077403_0"
      },
      {
        "positions": [
          null,
          null,
          null,
          {
            "id": "form_1787860077403-1 (QB)-1787860077403_3",
            "name": "1 (QB)"
          },
          null,
          null,
          null
        ],
        "id": "row_1787860077403_1",
        "label": "Wideouts (X, Z)",
        "slotCount": 7
      },
      {
        "positions": [
          null,
          null,
          null,
          {
            "id": "form_1787860077403-2 (FB)-1787860077403_3",
            "name": "2 (FB)"
          },
          null,
          null,
          null
        ],
        "id": "row_1787860077403_2",
        "slotCount": 7,
        "label": "Backfield (1 - 2 - 3 Stack)"
      },
      {
        "label": "New Level",
        "slotCount": 7,
        "id": "row_1787860077403_3",
        "positions": [
          null,
          null,
          {
            "id": "form_1787860077403-3 (HB)-1787860077403_3",
            "name": "3 (HB)"
          },
          null,
          {
            "id": "form_1787860077403-Z-1787860077403_6",
            "name": "4"
          },
          null,
          null
        ]
      }
    ],
    "collapsed": false
  },
  {
    "id": "form_1788270435286",
    "rows": [
      {
        "id": "row_1788270435286_0",
        "positions": [
          null,
          {
            "id": "form_1788270435286-LT-1788282198844",
            "name": "LT"
          },
          {
            "id": "form_1788270435286-LG-1788282193352",
            "name": "LG"
          },
          {
            "id": "form_1788270435286-C-1788282189705",
            "name": "C"
          },
          {
            "id": "form_1788270435286-RG-1788282183399",
            "name": "RG"
          },
          {
            "id": "form_1788270435286-RT-1788282180009",
            "name": "RT"
          },
          {
            "id": "form_1788270435286-Y1-1788282176233",
            "name": "Y1"
          }
        ],
        "slotCount": 7,
        "label": "Offensive Line & TE (Y1)"
      },
      {
        "positions": [
          {
            "id": "form_1788270435286-X",
            "name": "X"
          },
          null,
          null,
          null,
          null,
          {
            "id": "form_1788270435286-W",
            "name": "W"
          },
          {
            "id": "form_1788270435286-Z",
            "name": "Z"
          }
        ],
        "label": "Wide Receivers (X, W, Z)",
        "id": "row_1788270435286_1",
        "slotCount": 7
      },
      {
        "id": "row_1788270435286_2",
        "slotCount": 7,
        "label": "Backfield (1 - 4)",
        "positions": [
          null,
          null,
          null,
          {
            "id": "form_1788270435286-1",
            "name": "1 (QB)"
          },
          {
            "id": "form_1788270435286-4",
            "name": "4 (RB)"
          },
          null,
          null
        ]
      }
    ],
    "collapsed": false,
    "unit": "offense",
    "name": "11 Personnel"
  },
  {
    "name": "53 Defense",
    "id": "form_53",
    "rows": [
      {
        "positions": [
          null,
          null,
          null,
          {
            "id": "53-FS",
            "name": "FS"
          },
          null,
          null,
          null
        ],
        "slotCount": 7,
        "rowClass": "secondary-safety",
        "label": "Single Free Safety",
        "id": "row_53_fs"
      },
      {
        "positions": [
          {
            "id": "53-CB1",
            "name": "CB 2"
          },
          null,
          null,
          null,
          null,
          null,
          {
            "id": "53-CB2",
            "name": "CB 1"
          }
        ],
        "label": "Cornerbacks",
        "slotCount": 7,
        "id": "row_53_cb",
        "rowClass": "secondary-corners"
      },
      {
        "id": "row_53_lb",
        "slotCount": 7,
        "label": "Linebacker Level (WILL - MIKE - SAM)",
        "rowClass": "linebackers-tight",
        "positions": [
          null,
          null,
          {
            "id": "53-WILL",
            "name": "WILL"
          },
          {
            "id": "53-MIKE",
            "name": "MIKE"
          },
          {
            "id": "53-SAM",
            "name": "SAM"
          },
          null,
          null
        ]
      },
      {
        "id": "row_53_dl",
        "rowClass": "dl",
        "positions": [
          null,
          {
            "id": "53-DE1",
            "name": "DE 1"
          },
          {
            "id": "53-DT1",
            "name": "DT 1"
          },
          {
            "id": "53-NT",
            "name": "NT"
          },
          {
            "id": "53-DT2",
            "name": "DT 2"
          },
          {
            "id": "53-DE2",
            "name": "DE 2"
          },
          null
        ],
        "label": "Defensive Line (DE1 - DT1 - NT - DT2 - DE2)",
        "slotCount": 7
      }
    ],
    "subtitle": "Odd Front (11 Positions)",
    "collapsed": false,
    "unit": "defense"
  },
  {
    "name": "44 Defense",
    "id": "form_44",
    "rows": [
      {
        "id": "row_44_fs",
        "positions": [
          null,
          null,
          null,
          {
            "id": "44-FS",
            "name": "FS"
          },
          null,
          null,
          null
        ],
        "slotCount": 7,
        "rowClass": "secondary-safety",
        "label": "Free Safety (Deep Center)"
      },
      {
        "rowClass": "secondary-corners",
        "slotCount": 7,
        "label": "Secondary / Cornerbacks",
        "positions": [
          {
            "id": "44-CB2",
            "name": "CB 2"
          },
          null,
          null,
          null,
          null,
          null,
          {
            "id": "44-CB1",
            "name": "CB 1"
          }
        ],
        "id": "row_44_cb"
      },
      {
        "label": "Linebacker Level (ROVER - WILL - MIKE - SAM)",
        "rowClass": "linebackers-tight",
        "slotCount": 6,
        "positions": [
          null,
          {
            "id": "44-ROVER",
            "name": "ROVER"
          },
          {
            "id": "44-WILL",
            "name": "WILL"
          },
          {
            "id": "44-MIKE",
            "name": "MIKE"
          },
          {
            "id": "44-SAM",
            "name": "SAM"
          },
          null
        ],
        "id": "row_44_lb"
      },
      {
        "id": "row_44_dl",
        "rowClass": "dl",
        "positions": [
          null,
          {
            "id": "44-WDE",
            "name": "WDE"
          },
          {
            "id": "44-DT1",
            "name": "DT 1"
          },
          {
            "id": "44-DT2",
            "name": "DT 2"
          },
          {
            "id": "44-SDE",
            "name": "SDE"
          },
          null
        ],
        "slotCount": 6,
        "label": "Defensive Line (WDE - DT1 - DT2 - SDE)"
      }
    ],
    "collapsed": false,
    "unit": "defense",
    "subtitle": "Stack Front (11 Positions)"
  },
  {
    "name": "Kickoff Team",
    "id": "form_ko",
    "unit": "st",
    "subtitle": "8 Coverage + 3 Backs",
    "rows": [
      {
        "label": "Front Coverage Line (L1-L4, R4-R1)",
        "slotCount": 8,
        "rowClass": "oline",
        "positions": [
          {
            "id": "KO-L1",
            "name": "L1"
          },
          {
            "id": "KO-L2",
            "name": "L2"
          },
          {
            "id": "KO-L3",
            "name": "L3"
          },
          {
            "id": "KO-L4",
            "name": "L4"
          },
          {
            "id": "KO-R4",
            "name": "R4"
          },
          {
            "id": "KO-R3",
            "name": "R3"
          },
          {
            "id": "KO-R2",
            "name": "R2"
          },
          {
            "id": "form_ko-R1-1788283739249_7",
            "name": "R1"
          }
        ],
        "id": "row_ko_line"
      },
      {
        "id": "row_ko_bk",
        "positions": [
          null,
          {
            "id": "KO-LBH",
            "name": "LBH"
          },
          null,
          {
            "id": "KO-KICKER",
            "name": "Kicker"
          },
          null,
          {
            "id": "KO-RBH",
            "name": "RBH"
          },
          null
        ],
        "label": "Backfield Level (LBH - Kicker - RBH)",
        "slotCount": 7,
        "rowClass": "oline"
      }
    ],
    "collapsed": false
  },
  {
    "name": "Kick Return Team",
    "id": "form_kr",
    "collapsed": false,
    "rows": [
      {
        "label": "Front Blocking Line (T - G - C - G - T)",
        "slotCount": 7,
        "id": "row_kr_line",
        "positions": [
          {
            "id": "KR-T1",
            "name": "T1"
          },
          null,
          {
            "id": "KR-G1",
            "name": "G1"
          },
          {
            "id": "KR-C",
            "name": "C"
          },
          {
            "id": "KR-G2",
            "name": "G2"
          },
          null,
          {
            "id": "KR-T2",
            "name": "T2"
          }
        ],
        "rowClass": "oline"
      },
      {
        "id": "row_kr_w1",
        "positions": [
          null,
          null,
          {
            "id": "KR-XL1",
            "name": "XL1"
          },
          null,
          {
            "id": "KR-XR1",
            "name": "XR1"
          },
          null,
          null
        ],
        "label": "Wedge Level 1",
        "rowClass": "oline",
        "slotCount": 7
      },
      {
        "label": "Wedge Level 2",
        "slotCount": 7,
        "id": "row_kr_w2",
        "positions": [
          null,
          {
            "id": "KR-XL2",
            "name": "XL2"
          },
          null,
          null,
          null,
          {
            "id": "KR-XR2",
            "name": "XR2"
          },
          null
        ],
        "rowClass": "oline"
      },
      {
        "rowClass": "oline",
        "positions": [
          null,
          null,
          {
            "id": "KR-XL3",
            "name": "XL3"
          },
          null,
          {
            "id": "KR-XR3",
            "name": "XR3"
          },
          null,
          null
        ],
        "id": "row_kr_w3",
        "slotCount": 7,
        "label": "Deep Returners"
      }
    ],
    "subtitle": "5 Line + 6 Staggered Returners",
    "unit": "st"
  },
  {
    "name": "Punt Team",
    "subtitle": "Protection Line - Wings - Backfield",
    "collapsed": false,
    "id": "form_punt",
    "rows": [
      {
        "positions": [
          {
            "id": "PUNT-Y2",
            "name": "Y2"
          },
          {
            "id": "PUNT-LT",
            "name": "LT"
          },
          {
            "id": "PUNT-LG",
            "name": "LG"
          },
          {
            "id": "PUNT-C",
            "name": "C"
          },
          {
            "id": "PUNT-RG",
            "name": "RG"
          },
          {
            "id": "PUNT-RT",
            "name": "RT"
          },
          {
            "id": "PUNT-Y1",
            "name": "Y1"
          }
        ],
        "rowClass": "oline",
        "slotCount": 7,
        "id": "row_punt_ol",
        "label": "Punt Protection Line"
      },
      {
        "slotCount": 7,
        "id": "row_punt_gn",
        "rowClass": "receivers",
        "label": "Wide Gunners (3 & 4)",
        "positions": [
          {
            "id": "PUNT-3",
            "name": "Gunner 3"
          },
          null,
          null,
          null,
          {
            "id": "PUNT-2",
            "name": "PP (#2)"
          },
          null,
          {
            "id": "PUNT-4",
            "name": "Gunner 4"
          }
        ]
      },
      {
        "positions": [
          null,
          null,
          null,
          {
            "id": "PUNT-KICKER",
            "name": "Punter"
          },
          null,
          null,
          null
        ],
        "id": "row_punt_bk",
        "slotCount": 7,
        "rowClass": "backfield",
        "label": "Personal Protector & Punter"
      }
    ],
    "unit": "st"
  },
  {
    "rows": [
      {
        "id": "row_fg_ol",
        "label": "Protection Line",
        "slotCount": 7,
        "rowClass": "oline",
        "positions": [
          {
            "id": "FG-LE",
            "name": "LE"
          },
          {
            "id": "FG-LT",
            "name": "LT"
          },
          {
            "id": "FG-LG",
            "name": "LG"
          },
          {
            "id": "FG-LS",
            "name": "LS"
          },
          {
            "id": "FG-RG",
            "name": "RG"
          },
          {
            "id": "FG-RT",
            "name": "RT"
          },
          {
            "id": "FG-RE",
            "name": "RE"
          }
        ]
      },
      {
        "rowClass": "receivers",
        "slotCount": 7,
        "label": "Wing Blockers",
        "positions": [
          {
            "id": "FG-WL",
            "name": "Wing L"
          },
          {
            "id": "FG-WR",
            "name": "Wing R"
          },
          null,
          null,
          null,
          null,
          null
        ],
        "id": "row_fg_wg"
      },
      {
        "rowClass": "backfield",
        "slotCount": 7,
        "label": "Holder & Kicker",
        "positions": [
          {
            "id": "FG-H",
            "name": "Holder"
          },
          {
            "id": "FG-K",
            "name": "Kicker"
          },
          null,
          null,
          null,
          null,
          null
        ],
        "id": "row_fg_bk"
      }
    ],
    "unit": "st",
    "collapsed": false,
    "name": "Field Goal / PAT Team",
    "id": "form_fg",
    "subtitle": "Line - Wings - Holder - Kicker"
  },
  {
    "name": "Defensive Depth Chart",
    "subtitle": "44 Stack Format",
    "rows": [
      {
        "rowClass": "secondary-corners",
        "slotCount": 7,
        "positions": [
          {
            "id": "GRP-CB1",
            "name": "CB 1"
          },
          null,
          null,
          {
            "id": "GRP-FS",
            "name": "FS"
          },
          null,
          null,
          {
            "id": "GRP-CB2",
            "name": "CB 2"
          }
        ],
        "id": "row_grp_sec",
        "label": "Secondary Level"
      },
      {
        "rowClass": "linebackers-tight",
        "slotCount": 6,
        "id": "row_grp_lb",
        "positions": [
          null,
          {
            "id": "GRP-ROVER",
            "name": "ROVER"
          },
          {
            "id": "GRP-WILL",
            "name": "WILL"
          },
          {
            "id": "GRP-MIKE",
            "name": "MIKE"
          },
          {
            "id": "GRP-SAM",
            "name": "SAM"
          },
          null
        ],
        "label": "Linebacker Level (ROVER - WILL - MIKE - SAM)"
      },
      {
        "label": "Defensive Line (WDE - DT1 - DT2 - SDE)",
        "id": "row_grp_dl",
        "positions": [
          null,
          {
            "id": "GRP-WDE",
            "name": "WDE"
          },
          {
            "id": "GRP-DT1",
            "name": "DT 1"
          },
          {
            "id": "GRP-DT2",
            "name": "DT 2"
          },
          {
            "id": "GRP-SDE",
            "name": "SDE"
          },
          null
        ],
        "rowClass": "dl",
        "slotCount": 6
      }
    ],
    "id": "form_grp_def",
    "unit": "groups",
    "collapsed": false
  },
  {
    "name": "Offensive Depth Chart",
    "subtitle": "Standard Format",
    "collapsed": false,
    "rows": [
      {
        "label": "Offensive Line & Tight Ends",
        "id": "row_grp_ol",
        "slotCount": 7,
        "positions": [
          null,
          {
            "id": "GRP-LT",
            "name": "LT"
          },
          {
            "id": "GRP-LG",
            "name": "LG"
          },
          {
            "id": "GRP-C",
            "name": "C"
          },
          {
            "id": "GRP-RG",
            "name": "RG"
          },
          {
            "id": "GRP-RT",
            "name": "RT"
          },
          {
            "id": "GRP-TES",
            "name": "TEs"
          }
        ],
        "rowClass": "oline"
      },
      {
        "id": "row_grp_wr",
        "label": "Wide Receivers",
        "slotCount": 7,
        "positions": [
          null,
          null,
          null,
          {
            "id": "GRP-QB",
            "name": "QB"
          },
          null,
          {
            "id": "GRP-X",
            "name": "X"
          },
          {
            "id": "GRP-Z",
            "name": "Z"
          }
        ],
        "rowClass": "receivers"
      },
      {
        "positions": [
          null,
          null,
          null,
          {
            "id": "GRP-RB",
            "name": "RB"
          },
          {
            "id": "GRP-FB",
            "name": "FB"
          },
          null,
          null
        ],
        "label": "Backfield Stack",
        "id": "row_grp_bk",
        "rowClass": "backfield",
        "slotCount": 7
      }
    ],
    "unit": "groups",
    "id": "form_grp_off"
  }
];

export const DEFAULT_CASCADING_DRILLS: DrillFolder[] = [
  {
    "drills": [
      {
        "key": "Keep whiteboard sessions extremely brief for 8U/10U. Get them on the field and use visual aids to walk through the fits.",
        "desc": "Coaches review weekly game plan, formations, audibles, and opponent defensive/offensive tendencies on whiteboard before walking through cards. Gather the offensive unit in front of the whiteboard to install new plays, formations, and signals.",
        "name": "General: Team Install (Chalk Talk)"
      },
      {
        "name": "General: Mandatory Water Break",
        "key": "Emphasize fast hydration and hustling back to position groups",
        "desc": "Blow whistle twice. Players remove helmets and jog to water stations."
      },
      {
        "key": "",
        "desc": "",
        "name": "Quick Water Break"
      }
    ],
    "subfolders": [],
    "name": "📋 General"
  },
  {
    "drills": [],
    "name": "⚡ (Warm-up, Agility and Conditioning)",
    "subfolders": [
      {
        "name": "Warm-Up",
        "subfolders": [],
        "drills": [
          {
            "key": "Make sure they understand basic athletic stances (feet, sink, holsters) before rushing through the motions",
            "name": "Warm-Up: Dynamic Progression 1 (Expanded)",
            "desc": "Set up 5 lines spaced 5 yards apart. Clap it up, Feet-Sink-Holsters (20s x2), 10 Jumping Jacks, 10 Seal Jacks, 10 Squats"
          },
          {
            "key": "Keep the tempo fast to maintain the attention of younger athletes",
            "name": "Warm-Up: Dynamic Progression 1 (Extended)",
            "desc": "10 Jump in Place, 10 Push-ups, 10 Leg Raises, Butt Raises w/ wrap, finish with 2 burpees"
          },
          {
            "name": "Warm-Up: Dynamic Progression 2 (Condensed)",
            "key": "Proper form on high knees and butt kicks; pump the arms and stay on the balls of the feet",
            "desc": "Breakdown & catch football, High Knees, Butt Kicks, Frankensteins"
          },
          {
            "desc": "Line team up on the sideline or hash marks. Coach leads cadence. Perform high knees, karaoke, butt kicks, shuffling, and 10-yard short sprints",
            "name": "Warm-Up: Dynamic Line Cadences",
            "key": "Build team unity by having the entire team sound off on the cadence together"
          }
        ]
      },
      {
        "name": "Agility",
        "subfolders": [],
        "drills": [
          {
            "name": "Agility: Backpedal & Shuffle",
            "desc": "Long/Short Step Backpedal, Sideways Shuffle",
            "key": "Watch their hips during the transition from shuffle to backpedal. Remind them to stay low in the tunnel"
          },
          {
            "name": "Agility: 4-Way Direction Change",
            "key": "React instantly to the coach's hand signals; keep feet buzzing and center of gravity low",
            "desc": "Feet chopping with 4-way direction change"
          },
          {
            "name": "Agility: Bear Crawl & Roll",
            "key": "Builds core strength and teaches kids how to safely fall and pop back into a football stance",
            "desc": "Bear Crawls into Roll & Pop Up"
          },
          {
            "desc": "Lobsters, Swoop Drill",
            "name": "Agility: Lobsters & Swoop",
            "key": "Swoop into a low coiled contact posture; come to a complete controlled stop"
          },
          {
            "key": "Focus on the violent arm movements to clear blocks vertically, not horizontally",
            "desc": "Rip Drill (Elbow-Dip-Rip), Swim Drill (Stagger-Hinge-Swim), Fake Rip Spin",
            "name": "Agility: Rip & Swim Warm-Up"
          },
          {
            "desc": "5 cones configured in 'M' pattern (10x10 yds). Athlete sprints to cone 1, shuffles across to cone 2, backpedals diagonally to cone 3, sprints forward to cone 4, and breaks down at cone 5",
            "key": "Plant hard on the outside foot when changing directions. Drop hips to avoid false steps",
            "name": "Agility: M Drill"
          },
          {
            "name": "Agility: Timed 40-Yard / 20-Yard Dash",
            "desc": "Stopwatch, cones at 0, 20, and 40 yards. Player starts in 3-point or 2-point sprinter stance behind line. Sprint through finish line at maximum acceleration",
            "key": "Focus on forward arm drive (cheek to pocket) rather than side-to-side rotation"
          },
          {
            "key": "Emphasize touching the line with the outside hand to force them to drop their center of gravity and plant firmly on the outside foot",
            "name": "Agility: Pro-Agility 5-10-5 Shuttle",
            "desc": "Cones at 5, 10, 15 yards. Sprint 5 yds right, touch line, sprint 10 yds left, touch line, sprint 5 yds through middle"
          },
          {
            "name": "Agility: 3-Cone L-Drill",
            "desc": "Set cones in L-cone shape. Sprint 5 yds, touch line, sprint back, loop outside cone, figure-8 around middle cone",
            "key": "Tight turns around the cones; dip the inside shoulder to maintain speed"
          },
          {
            "name": "Agility: Coach Dave Says (Discipline Sprints)",
            "desc": "Full team lined up on goal line / LOS. Team lines up in stance. Coach uses various vocal cadences (Ready Go, Hut 1, Hut 2). Players must sprint 10-15 yards only on the live snap cadence",
            "key": "If anyone jumps offsides, team is pushed back 5 yards. Teach them to key the ball movement or the exact sound, turning discipline into a fun game"
          },
          {
            "desc": "Coach stands with tennis balls in front of the players. Player backpedals or shuffles; coach drops or bounces a tennis ball unpredictably. Player must react, change direction, sprint, and catch the ball before the second bounce",
            "name": "Agility: Tennis Ball Reaction Drill",
            "key": "Great for defensive backs and linebackers to develop twitch reflexes. Remind them to break off their outside foot and drive the arms"
          },
          {
            "desc": "Set up 2-3 agility ladders. Players run through doing icky shuffle, two-in, and lateral quick steps",
            "name": "Agility: Agility Ladder",
            "key": "Keep the line moving fast. Keep eyes up rather than staring at the ground"
          },
          {
            "desc": "Player starts in breakdown stance circling Tackle Jack circular dummy. 1st whistle = shuffle in circle; 2nd whistle = change direction immediately; 3rd whistle = swoop and tackle",
            "name": "Agility: Tackle Jack (Shuffle & Change Direction)",
            "key": "Improves lateral agility and the ability to transition from moving sideways to exploding downhill"
          },
          {
            "key": "Low center of gravity!. No hopping or clicking heels together during transition",
            "desc": "5 cones in W shape 5 yards apart. Backpedal with chest over toes to Cone 1, plant outside foot, drive 45 degrees forward to Cone 2",
            "name": "Agility: W-Drill (Backpedal & Drive)"
          }
        ]
      }
    ]
  },
  {
    "drills": [],
    "subfolders": [
      {
        "subfolders": [],
        "drills": [
          {
            "key": "For youth QBs, mastering the snap exchange without fumbling is step one. Ensure the QB is applying firm pressure to the center's backside",
            "desc": "Center snaps to QB. QB executes 3-step or 5-step drop on air. Coach watches feet to ensure no false steps or heel clicking",
            "name": "Offense QB: Under Center Snap & Drop"
          },
          {
            "name": "Offense QB: Shotgun Snap & Quick Game",
            "desc": "QB takes shotgun snap. Instantly sets feet and throws a quick slant or hitch to a target. Focus on catching and throwing in one rhythm",
            "key": "Eliminate the extra pat or wind-up. Catch the lace-up chest delivery, step to the target, and release"
          },
          {
            "key": "Teach the QB to carry out the fake for two full steps with empty hands to freeze the linebackers before rolling out",
            "name": "Offense QB: Play-Action Bootleg Mesh",
            "desc": "QB executes a hard run fake to the back, drops the ball to the hip, snaps head around, and sprints to the edge to deliver a pass"
          },
          {
            "name": "Offense QB: Target Accuracy Net Drill",
            "desc": "Set up a net or targets at 5, 10, and 15 yards. QBs drop back and throw 5 passes to each target aiming for the center pocket",
            "key": "Focus on the lower body mechanics—ensure the front toe points exactly at the target net upon release"
          },
          {
            "desc": "Rolling right and left throwing on the run while squaring shoulders to target",
            "key": "Teach the QB to avoid throwing off their back foot while sprinting to the edge",
            "name": "Offense QB: On-Run & Off-Platform Throws"
          }
        ],
        "name": "Quarterbacks (QB)"
      },
      {
        "subfolders": [],
        "name": "Running Backs (RB)",
        "drills": [
          {
            "desc": "QB takes snap, opens to correct side, seats ball in RB's stomach. RB forms proper pocket (inside elbow up, outside elbow down), clamps down softly, and bursts through designed hole",
            "key": "At the 8U/10U level, ball security is paramount. Create a 'no daylight' rule—there should be no space between the ball and the ribcage",
            "name": "Offense RB: Handoff Mesh & Ball Security"
          },
          {
            "key": "Stop the youth habit of bouncing every play outside. Emphasize attacking the line of scrimmage with shoulders square",
            "desc": "Place bags simulating linemen. RB takes the handoff and attacks the A or B gap immediately. RB must hit the hole without dancing, press downhill, and plant foot to cut off blocker's hip",
            "name": "Offense RB: Downhill A/B Gap Press"
          },
          {
            "key": "Tell the backs to keep their pad level low and keep their legs churning through the bags. If they stop their feet, they fail the drill",
            "name": "Offense RB: Running Back Gauntlet",
            "desc": "Line up 4-6 players holding hit shields creating a tight chute. RB takes handoff, secures football with 4 points of pressure (high and tight), drives knees through heavy contact, maintains balance, and accelerates out"
          },
          {
            "key": "Force the defense to flow laterally before planting the outside foot and exploding north and south",
            "desc": "Set cones marking a wide track. RB takes a toss or wide handoff, runs flat down the line, and cuts upfield outside the last cone",
            "name": "Offense RB: Outside Zone / Sweep Track"
          },
          {
            "name": "Offense RB: Pass Protection & Blitz Pickup",
            "key": "Meet the blitzer at the line of scrimmage; do not wait in the backfield. Strike with the heel of the hands",
            "desc": "RB steps up into A/B gap, square shoulders, strike oncoming linebacker in the chest plate, and anchor"
          },
          {
            "name": "Offense RB: Perimeter Press & Cutback Reaction (Outside vs Cutback Lanes)",
            "key": "Press the perimeter edge with speed to stretch defense horizontally; read force defender to bounce wide or plant outside foot violently at 90 degrees into cutback lane",
            "desc": "Wide zone/stretch track drill. RB presses edge track to force defense pursuit flow. If edge is won/pinned, RB accelerates around corner cone up the numbers. If defender sets hard outside edge, RB violently plants outside foot, drops hips, and slashes 90 degrees downhill through cutback crease. Mix 2 outside bounce runs with surprise cutback reads."
          }
        ]
      },
      {
        "drills": [
          {
            "desc": "O-Linemen align in 3-point stance straddling board with blocker shield. Fire out 6-inch power step, strike chest plate with thumbs up",
            "key": "The 6-inch step prevents kids from over-striding and losing their balance. Teach them to strike with the heels of their hands",
            "name": "Offense OL: 6-Inch Power Step & Board Fit"
          },
          {
            "name": "Offense OL: Drive Blocking & Chute Drills",
            "desc": "Explosion steps staying under the chute. Keep thumbs up, elbows tight, and legs driving through contact",
            "key": "Low man wins. The chute forces them to play with proper pad level, which is critical since young linemen tend to stand straight up off the snap"
          },
          {
            "desc": "Execute flat pulling footwork across formation, locate kicking target (DE/LB), and deliver blow with inside shoulder",
            "name": "Offense OL: Pulling Guard & Trap Technique",
            "key": "If they bow out too deep in the backfield, they will collide with the running back. Emphasize staying tight to the center's heels"
          },
          {
            "key": "Muscle memory for footwork. Focus on taking a lateral angle for a reach block without standing up",
            "name": "Offense OL: First 2 Steps Progression",
            "desc": "Linemen line up in 3-point stance. Practice first 2 explosive steps on air on cadence: drive block step, reach step, down block step, or scoop step"
          },
          {
            "key": "Use for two-way players. Emphasize full arm extension to keep the offensive player off the chest plate",
            "name": "Offense OL: Shock & Shed (Block Defeat)",
            "desc": "Lineman strikes a blocker with violent hands, extends arms to gain leverage, locates ball carrier, and rips off the block to make the tackle"
          }
        ],
        "name": "Offensive Line (OL)",
        "subfolders": []
      },
      {
        "name": "Wide Receivers & Tight Ends (WR/TE)",
        "subfolders": [],
        "drills": [
          {
            "key": "Drive off the front foot instantly. No backwards rocking",
            "desc": "Receivers line up in proper 2-point stance (inside foot up). Speed release and square cut release off the line of scrimmage against press coverage. Explode off the line for 5 yards without any false steps or rocking",
            "name": "Offense WR: Stance & Release Package"
          },
          {
            "key": "Focus on sharp cuts at the correct yardage depth rather than rounding off the corners",
            "name": "Offense WR: Route Tree Landmarks",
            "desc": "Run precise depth routes (Slants at 5 yds, Outs at 10 yds, Curls at 12 yds) planting on correct foot"
          },
          {
            "key": "Keep their feet chopping like a basketball defender. If their feet stop, the defender will easily shed the block",
            "desc": "WR sprints 5 yards at a defender, breaks down, buzzes feet, and engages the chest plate to block for a run play",
            "name": "Offense WR: Stalk Blocking"
          },
          {
            "name": "Offense WR: Catch & Tuck (Gauntlet)",
            "desc": "WR catches a pass over the middle and instantly tucks the ball away while running through two coaches holding pads",
            "key": "Look the ball all the way into the tuck before anticipating contact"
          },
          {
            "name": "Offense WR: Receiving Technique & Diamond Hands",
            "desc": "Players run short routes. Catch with hands, never with body. Diamond hand shape (thumbs and index fingers touching) for chest/high balls; pinkies touching for balls below waist",
            "key": "Youth players often try to body-catch everything. Force them to extend their arms and take a picture of the ball through their diamond fingers"
          },
          {
            "key": "Keep a wide base to prevent getting thrown off balance by a slanting defensive end",
            "desc": "Engage Defensive End with tight base, drive helmet across bow, and seal B-gap on inside runs",
            "name": "Offense TE: Inline Drive Block & Seal"
          },
          {
            "key": "Identify if the LB is playing physical. Use a quick swim move to avoid the jam before looking back for the ball",
            "desc": "Release vertical up the seam past outside linebacker while reading zone coverage dropping underneath",
            "name": "Offense TE: Seam Release & Reroute Read"
          }
        ]
      },
      {
        "drills": [
          {
            "name": "Offense Group: Individual Stance & Alignment",
            "desc": "Skill and line players work on correct 2-point or 3-point stances, splits, and alignment rules",
            "key": "Crucial foundational drill. Do not move to active plays until every player can align legally on the LOS"
          },
          {
            "desc": "Centers and QBs pair up. Execute 20 perfect snaps under center (dead ball snap, firm into QB palm) followed by 20 shotgun snaps",
            "name": "Offense Group: QB & Center Exchange",
            "key": "Repetition builds muscle memory. Center immediately assumes pass/run block posture after snap"
          },
          {
            "key": "Mental reps. Everyone must know their assignment, alignment, and motion rules before going live",
            "desc": "Huddle the full 11-man offensive unit. Walk through new plays vs. garbage cans or scout defense. No pads/helmets",
            "name": "Offense Group: Offensive Play Install (Walkthrough)"
          },
          {
            "name": "Offense Group: Full Offensive Install & Skelly",
            "key": "Timing and spacing. WRs must run to their exact depths, and the QB must read the coverage shell",
            "desc": "Install weekly run scheme and passing concepts against scout team defense in 7-on-7 and 11-on-11 jog-throughs"
          },
          {
            "key": "Game simulation. Focus on line communication and hitting the correct hole at full speed",
            "name": "Offense Group: 11-on-11 Run Game Scrimmage",
            "desc": "Live blocking and tackling. Offense runs strictly inside/outside run plays vs the starting defense"
          }
        ],
        "name": "Offensive Group Install",
        "subfolders": []
      }
    ],
    "name": "🏈 Offense"
  },
  {
    "drills": [],
    "name": "🛡️ Defense",
    "subfolders": [
      {
        "subfolders": [],
        "name": "Defensive Line (DL)",
        "drills": [
          {
            "name": "Defense DL: DL Stance & Shock (First-Step Strike)",
            "desc": "Line up in low, staggered 3-point stance 6 inches off sled. On ball movement, fire out with 2 short foot-churning steps. Shoot hands violently upward into blocker's chest right below armpits with thumbs up and elbows in",
            "key": "Reaction time is key. Use a football on a stick to teach them to move on the ball, not on the offense's cadence"
          },
          {
            "name": "Defense DL: DL Slant & Rip (Vertical Penetration)",
            "desc": "On snap, take explosive vertical power step across LOS into slanting gap. Strike with inside arm, dip shoulder, execute violent vertical rip with outside arm (bicep-to-earhole)",
            "key": "Execute the move vertically. Clear hip at 1 yard deep, flatten pursuit angle ('pinch'), and tackle"
          },
          {
            "key": "The most important rule for young edge players: Never get reached and never let the ball carrier outside of your outside shoulder",
            "name": "Defense DL: DE Containment Stiff-Arm Track",
            "desc": "Fire vertically across LOS. As blocker climbs, strike blocker's outside shoulder with locked-out rigid inside arm. Keep outside arm and shoulder high and completely free"
          },
          {
            "key": "'Squeeze & Check Boot/Reverse': Squeeze down the LOS to the depth of the QB. Do not chase flat from behind",
            "desc": "DE takes initial vertical containment read step. On diagnosing flow away, transition immediately to backside rule: squeeze down LOS, settle at containment depth 2 yards deeper than deepest back, shuffle parallel to LOS watching QB",
            "name": "Defense DL: DE Backside Squeeze & Settle"
          },
          {
            "key": "Pad level is king!. The lower man wins the A-gap collision every single time",
            "name": "Defense DL: Nose Guard Bull & 2-Gap Strike",
            "desc": "NG aligns 0-Tech opposite Center with pad. Fire low, strike breastplate, lock out arms, peek into A-gap of ball flow, and shed"
          },
          {
            "key": "'Violent Hands!'. Create separation instantly so the guard cannot reach your chest",
            "desc": "DT vs offensive guard with shield attempting base block. Strike with violent hands, drop hips, rip through outside arm into B-gap",
            "name": "Defense DL: Defensive Tackle Shed & Spill"
          },
          {
            "key": "Never get reached!. If DL gets driven backward, interior run lane opens up",
            "desc": "OT down-blocks on DL while OG pulls. DL reads down-block, presses into OT hip to squeeze hole, spills play wide",
            "name": "Defense DL: Down-Block Squeeze & Spill"
          },
          {
            "key": "Dip inside shoulder low ('scrape grass') and rip upward through the OT armpit. Flatten immediately to QB launch spot",
            "desc": "DE bends around agile hoop or circular cones from 7-technique. Dip inside shoulder under OT punch hands, rip upward violently, and flatten sharply to the quarterback without getting washed upfield",
            "name": "Defense DL: Hoop Bend & Dip (Edge Rusher Corner Flatten)"
          },
          {
            "key": "Drop pad level under their breastplates. Drop down-knee and corkscrew into the post blocker. Eat the double team so linebackers scrape clean",
            "desc": "DT faces Guard and Tackle double team. On snap, DT strikes post blocker, drops hips, corkscrews to drop pad level, and wedges between blockers to anchor the line of scrimmage",
            "name": "Defense DL: 2-on-1 Split & Anchor (Defeating the Double Team)"
          },
          {
            "key": "Key blocker's helmet: Reach step means fight across face; Down block means squeeze the hip and hunt the kick-out puller",
            "desc": "DL lines up in 5-technique. Blocker gives either reach or down-block look. On reach, DL fights across face maintaining outside leverage; on down-block, DL squeezes down LOS to destroy the kick-out",
            "name": "Defense DL: Reach vs. Down Block Read (Hat-Track Mirror)"
          },
          {
            "key": "Yell 'SCREEN!' at the top of your lungs. If pass protection feels too easy, immediately plant cleats and retrace back into the tunnel",
            "desc": "Offensive line sets pass protection and releases to perimeter screen. DL recognizes 'too easy' rush, yells 'SCREEN!', plants outside foot, retraces footsteps, and chases down the ballcarrier from behind",
            "name": "Defense DL: Screen & Draw Retrace (High-Hat Recognition)"
          },
          {
            "key": "Violent club to knock down blocker's outside arm, followed by explosive upward rip. Keep hips square to target",
            "desc": "DL executes two-move pass rush moves against OT: Move 1 is Club-and-Rip (club punch arm, vertical rip through armpit); Move 2 is Chop-and-Swim (chop outside wrist, high arm swim through hip)",
            "name": "Defense DL: Pass Rush Club-Rip & Chop-Swim Progression"
          },
          {
            "key": "Aim for the throwing arm with tomahawk swipe. If ball is loose, scoop and score or smother with chest and knees",
            "desc": "DE closes on QB dummy from blind side, executes downward tomahawk swipe on football, followed by immediate scoop-and-score recovery or smother drill",
            "name": "Defense DL: Fumble Recovery & Strip-Sack Turnover Circuit"
          }
        ]
      },
      {
        "name": "Defensive Ends (DE)",
        "subfolders": [],
        "drills": [
          {
            "name": "Defense DE: Containment Stiff-Arm Track",
            "desc": "Fire vertically across LOS. As blocker climbs, strike blocker's outside shoulder with locked-out rigid inside arm. Keep outside arm and shoulder high and completely free to funnel ballcarrier back inside.",
            "key": "The most important rule for young edge players: Never get reached and never let the ball carrier outside of your outside shoulder."
          },
          {
            "name": "Defense DE: Backside Squeeze & Settle",
            "desc": "DE takes initial vertical containment read step. On diagnosing flow away, transition immediately to backside rule: squeeze down LOS, settle at containment depth 2 yards deeper than deepest back, shuffle parallel to LOS watching QB bootleg/counter.",
            "key": "'Squeeze & Check Boot/Reverse': Squeeze down the LOS to the depth of the QB. Do not chase flat from behind."
          },
          {
            "name": "Defense DE: Hoop Bend & Dip (Edge Rusher Corner Flatten)",
            "desc": "DE bends around agile hoop or circular cones from 7-technique. Dip inside shoulder under OT punch hands, rip upward violently, and flatten sharply to the quarterback without getting washed upfield.",
            "key": "Dip inside shoulder low ('scrape grass') and rip upward through the OT armpit. Flatten immediately to QB launch spot."
          },
          {
            "name": "Defense DE: Spill vs. Box Gap Fit (Wrong-Arm Puller)",
            "desc": "Offensive guard pulls to kick out DE. DE reads puller, attacks downhill, executes wrong-arm technique with inside shoulder into puller's inside hip to bounce running back outside into scraping linebacker.",
            "key": "'DL spills the soup, linebackers eat it!' Outside arm stays free or wrong-arm blows up the puller."
          },
          {
            "name": "Defense DE: Fumble Recovery & Strip-Sack Turnover Circuit",
            "desc": "DE closes on QB dummy from blind side, executes downward tomahawk swipe on football, followed by immediate scoop-and-score recovery or smother drill.",
            "key": "Aim for the throwing arm with tomahawk swipe. If ball is loose, scoop and score with two hands."
          }
        ]
      },
      {
        "name": "Linebackers (LB)",
        "subfolders": [],
        "drills": [
          {
            "key": "Do not commit blindly. Diagnose true ball carrier / play-action before committing",
            "desc": "Pre-snap: balanced knees bent, chest over toes, eyes on near running back. On snap, take rapid 6-inch forward control step (freeze step) keeping low hip level and nose over toes",
            "name": "Defense LB: ILB 6-Inch Freeze Step"
          },
          {
            "key": "Teach linebackers not to over-pursue. If they cross the runner's face laterally, cutback lanes open up instantly",
            "desc": "RB flows laterally. LB shuffles with short choppy strides keeping shoulders square to field. Stay exactly 1 step behind runner's inside hip. Explode downhill when runner cuts vertical",
            "name": "Defense LB: ILB Mirror & Scrape (Inside-Out Flow)"
          },
          {
            "name": "Defense LB: Shock, Shed & Fill",
            "key": "LBs must attack the blocker on their side of the line of scrimmage. Don't catch blocks; deliver the blow",
            "desc": "LB steps downhill to meet lead blocker, delivers a heavy two-hand strike to the chest, sheds using a rip move, and fills the gap"
          },
          {
            "name": "Defense LB: OLB Leverage Step & Key Read (Sweep vs Kickout)",
            "desc": "Take explosive leverage step forward-lateral with inside foot. Read EMOL and near back flow. Sweep: turn hips and sprint to high-outside contain. Kickout: step downhill, squeeze edge, strike kicker",
            "key": "Keep shoulders square to sideline. If you turn your back, ball turns corner"
          },
          {
            "desc": "Coach raises ball (high hat). LBs open hips 45 degrees to zone depth (8-10 yds ILB, 10-12 yds OLB). Coach slaps ball; LBs plant and drive",
            "name": "Defense LB: 45-Degree Drop & Break Drill",
            "key": "Do not backpedal!. Opening hips allows maximum speed with vision on QB"
          },
          {
            "name": "Defense LB: Pass-Off & Robot Crosser Drill",
            "key": "Communication is mandatory!. Never let receiver cross zone untouched",
            "desc": "OLB jams/reroutes crosser, calls 'In! In!'. ILB picks up crosser, carries across zone, calls 'Out! Out!' to opposite LB"
          },
          {
            "key": "Do not cross your feet when shuffling!. Keep a wide base to plant and drive instantly",
            "desc": "Playside LB pushes wide; Backside LB takes controlled shuffle steps, reads pulling guard, and mirrors inside hip leverage to execute vice tackle",
            "name": "Defense LB: Backside Scrape & Cutback Vice"
          },
          {
            "name": "Defense LB: Triangle Block Pop & Directional Peek Drill",
            "desc": "Triangle alignment with LB at apex, blocker 2 yards ahead, and ball carrier 2-3 yards behind blocker. Coach calls out 'Right' or 'Left' lead foot to the LB (determining peek direction) while flashing a hand signal to the ball carrier to attack right or left. On movement, LB fires downhill with designated lead foot, delivers explosive two-hand pop strike to blocker's breastplate to create instant separation, and peeks into designated gap. When ball carrier cuts to opposite lane, LB disengages cleanly without grabbing cloth, resets his hips/feet, and redirects downhill to track and make the tackle.",
            "key": "Don't grab cloth on the pop-off!. Pop the blocker violently to create separation so he cannot latch on. Designated lead foot dictates your peek (Right lead = peek right; Left lead = peek left). Never guess or get tied up—strike, peek through the blocker, and reset hips instantly to redirect on cutbacks"
          },
          {
            "name": "Defense LB: Read-Step, Scrape & Spill to Alley Tackle",
            "key": "6-inch read step downhill without false stepping; high knees scraping laterally over bags with square shoulders; inside flipper strike to spill runner wide, then buzz feet into alley for chest-to-chest wrap tackle",
            "desc": "Place 3 step-over agile bags simulating interior LOS trash. LB takes 6-inch downhill read step on snap flow, scrapes laterally across bags with square shoulders, strikes oncoming lead blocker with inside shoulder flipper to spill the ball carrier wide into the perimeter alley, and disengages to finish with chest-to-chest wrap tackle."
          }
        ]
      },
      {
        "subfolders": [],
        "name": "Defensive Backs (DB)",
        "drills": [
          {
            "name": "Defense DB: Fast Alley Trigger & Breakdown",
            "desc": "FS takes 2 downhill read steps, inside-out pursuit angle, chops feet at 3 yds, clamps near hip",
            "key": "'Never Cross Near Hip!'. Stay inside. If you run too wide, runner cuts back inside"
          },
          {
            "name": "Defense DB: Centerfield Post Break & Intercept",
            "key": "Break on shoulder turn!. In Cover 3, do not wait for ball release—jump throwing lane early",
            "desc": "FS in center field vs deep post/seam. FS backpedals. Coach loads to throw. FS plants outside foot, drives 90 degrees across hashes, beats WR to catch point for interception"
          },
          {
            "name": "Defense DB: DB Backpedal & Break (45-Degree Drive)",
            "key": "Young DBs tend to stand straight up in their pedal. Emphasize a low center of gravity so they can transition into a sprint without taking false steps",
            "desc": "DB backpedals smoothly for 10 yards with low hips and chest over toes. On coach's visual/verbal signal, plant back foot, drive forward at 45-degree angle with zero false steps, accelerate, and catch"
          },
          {
            "key": "'Keep the Roof on!'. If receiver breaks cushion, turn and sprint to regain depth",
            "desc": "Corner aligned 6 yds off WR running vertical. Open 45 degrees in side-shuffle bail keeping 3 yds vertical cushion over receiver",
            "name": "Defense DB: Deep 1/3 Cushion & Route Bail"
          },
          {
            "key": "Never get hooked inside!. Maintain outside leverage at all costs to force the ball to pursuing teammates",
            "desc": "Defender reads run flow, attacks approaching WR's stalk block. Delivers firm two-hand punch to WR's chest, rips outside arm free, and maintains outside leverage to force runner inside",
            "name": "Defense DB: DB / OLB Defeat Stalk Block & Force"
          },
          {
            "name": "Defense DB: Tip & Overturn Turnover Drill",
            "desc": "3 DBs in tandem line, 5 yards apart. Lead DB jumps and tips high pass. Trailing DB tracks deflection, calls 'Ball! Ball!', catches, and sprints 15 yds",
            "key": "Finish the play!. Every interception ends with two hands high and tight"
          }
        ]
      },
      {
        "subfolders": [],
        "name": "Team Defense & Stunts / Blitzes",
        "drills": [
          {
            "name": "Defense Group: 11-Man 'Liz' Pursuit Drill",
            "desc": "Full 11-man defense executes run fits and inside-out pursuit angles on perimeter sweep. Every player must touch runner",
            "key": "Rule number one: 'Never follow same color jersey'. Take your own lane to the ball carrier to prevent getting walled off"
          },
          {
            "name": "Defense Group: Team Pursuit & Cutback Lane Contain Drill (Spencer Erickson)",
            "desc": "Full defensive unit works on individual pursuit angles against outside runs and sudden cutbacks (Winona State DC Spencer Erickson / Glazier Clinics). Ball carrier mixes outside bounces/sweeps with sharp cutbacks against the grain. Key rule: 'Run to where the ball carrier IS, not where he is going' and adjust pursuit angles so no defender trails behind a teammate. When RB bounces outside, perimeter defenders force and spill while backside LB, DE, and Safety maintain strict cutback lane leverage. On cutback, backside pursuit fires downhill to choke the lane and execute a multi-angle vice tackle.",
            "key": "Run to the ball carrier, NOT where you think he's going!. Never run behind a teammate—adjust your pursuit lane. When RB stretches outside, backside defenders MUST stay disciplined on cutback lanes. On cutback recognition, plant, redirect downhill, and collapse the vice with zero cutback seams"
          },
          {
            "key": "This completely cures the 'swarm' mentality typical in youth football by visually teaching them that holding their specific lane creates an inescapable defensive wall",
            "name": "Defense Group: Team Pursuit Angle Drill (11 Sideline Cones)",
            "desc": "11 cones spaced 2-3 yards apart along sideline from LOS to deep secondary. Defense fires off on ball movement. Coach blows whistle; all 11 defenders turn and sprint to their designated cone lane to form a wall"
          },
          {
            "name": "Defense Group: Stay at Home Counter Fit Drill",
            "desc": "Defense lines up with Backside DE, Backside ILB, and Backside OLB. Offense runs Counter. Backside ILB shuffles, reads pulling Guard, stays square, and fills counter hole downhill. Backside DE squeezes and contains boot",
            "key": "'Read Linemen, Not Eye Candy!'. If the Guard pulls across face, follow his hip directly to the ball"
          },
          {
            "name": "Defense Group: The Alley 'Vice' Tackle Drill",
            "desc": "1 OLB (Force), 1 ILB (Spill), 1 RB with blocker. RB attacks alley. ILB spills RB wide; OLB turns RB in. Both compress and execute two-man vice tackle",
            "key": "Wrap and drive!. Clamp near hip with active driving feet"
          },
          {
            "name": "Defense Group: 7-Man Defensive Coverage Drill",
            "desc": "7 defenders align in base Cover 3 or Cover 1. Walk through and execute pass drops (curl-to-hook, curl-to-flat, deep thirds). Communicate route handoffs, pass off crossers, and break on thrown ball",
            "key": "Communication is mandatory!. Never let receiver cross zone untouched"
          },
          {
            "key": "Walk through defensive alignments, blitz calls, and gap responsibilities against a scout offense at half-speed",
            "desc": "Install base 4-4/5-3 fronts, gap assignments, stunt checks, and secondary coverages against scout offense",
            "name": "Defense Group: Full Defensive Install & Run Fits"
          },
          {
            "key": "Call on strong-side run tendency to the Liz (TE) side; shuts down off-tackle power and sweeps",
            "name": "Defense Stunt: 4-4 Slant Liz",
            "desc": "Entire defensive line slants one gap to the Liz (left) side on snap. E9 attacks C/D, T3 slants into Left B, T1 slants into Left A, E5 slants inside into Right B. LBs adjust"
          },
          {
            "key": "Call against inside zone, ISO, and A-gap trap teams; confuses Center/Guard blocking rules",
            "name": "Defense Stunt: 4-4 Cross Liz (Interior Tackle Cross)",
            "desc": "T3 slants across Center into Right A-gap. T1 slants across Center into Left A-gap (scissor cross in the middle). DEs fire straight upfield with aggressive outside edge contain"
          },
          {
            "key": "Call against off-tackle runs, B-gap power, or QB sneak/A-gap dive tendencies",
            "name": "Defense Stunt: 4-4 Fan Liz",
            "desc": "T3 slants outward into Left B-gap; T1 slants outward into Right B-gap (Tackles 'Fan' out away from Center). DEs fire upfield. ILBs read Fan action and shoot downhill into vacant Left and Right A-gaps"
          },
          {
            "key": "Call against interior runs (Fullback dive, Iso, QB sneak) when offense attacks the Rip side",
            "desc": "All 4 DL pinch hard inside (E5 to B/C, T1 to Weak A, T3 to Strong A, E9 to Strong C). OLB Rover rushes/forces weak edge. ILBs fill B/C gap alleys vacated by pinching defensive linemen",
            "name": "Defense Stunt: 4-4 Pinch Rip"
          },
          {
            "name": "Defense Blitz: 4-4 Double Dog 0 Liz",
            "desc": "'Double Dog' - Both ILBs fire downhill on snap through A/B gaps right to the QB in Cover 0 man coverage. DL contain outside rush and slant inside",
            "key": "Call on 3rd & Long passing downs, clear passing sets; forces immediate throw under duress"
          },
          {
            "key": "Call on high-leverage 3rd down; disrupts protection schemes via edge twist",
            "desc": "Edge calls ('You'/'Me') coordinating DE crash and OLB blitz pressure with man coverage assignments across the board. 'ME' = OLB contains outside, DE crashes. 'YOU' = DE contains outside, OLB blitzes inside",
            "name": "Defense Blitz: 4-4 Blow Sting Liz (Edge Call)"
          }
        ]
      }
    ]
  },
  {
    "subfolders": [],
    "drills": [
      {
        "key": "This is the foundation of safe tackling. Do not let players advance to contact until they can perfectly demonstrate this swooping, coiled posture on command",
        "desc": "Players start in athletic stance. 1. Feet: shoulder-width apart, light on toes. 2. Squeeze: shoulder blades pinched, chest proud. 3. Sink: lower hips into a coiled power position (holsters). 4. Hands: hands up in holsters ready to strike",
        "name": "Tackling: Breakdown Fundamentals (Feet-Squeeze-Sink-Hands)"
      },
      {
        "key": "Next progression after breakdown before making contact. Prevents lunging and dropping the head",
        "desc": "Start 10 yards back, sprint to cone/dummy, break down, swoop into low coiled contact posture, come to a complete controlled stop straddling dummy",
        "name": "Tackling: Swoop Position Progression"
      },
      {
        "desc": "Tackler approaches ball carrier from an angle or head-on. Enforce stepping violently with the near foot (the foot closest to the runner/strike point) right before contact",
        "key": "Generates maximum power from the ground into the hips. Prevents reaching and arm tackling",
        "name": "Tackling: Near Foot Progression"
      },
      {
        "key": "Do not take to ground. Focus on the violent double uppercut wrap and grabbing the jersey on the back",
        "name": "Tackling: Form Tackle Fit & Uppercuts",
        "desc": "Pair up 2 yards apart. On whistle, tackler takes near-foot step, fits shoulder into target's breastplate/numbers, shoots violent double uppercuts into jersey, grabs cloth on the back, places head on opposite side"
      },
      {
        "desc": "Players start 2 yards apart. On whistle, step into ball carrier, fit shoulder to numbers, wrap arms tightly around cloth, and drive legs for 3-5 steps at thud tempo",
        "name": "Tackling: Form Fit & Drive (Thud)",
        "key": "Without taking runner to ground. Leg drive must finish the tackle"
      },
      {
        "desc": "Tackler starts on stomach or knees. On whistle, pop up explosively into breakdown, step with near foot, strike dummy/carrier with shoulder, execute uppercuts, grab jersey, and drive 5 yards",
        "name": "Tackling: Pop-Up Drill for Form Tackle",
        "key": "Builds explosive hip power and rapid transition from the ground to a striking position"
      },
      {
        "key": "Feet must not be charged; power generates purely from hip uncoil",
        "name": "Tackling: Shoot Drill (Hips & Uppercuts)",
        "desc": "Start in 3-point or 2-point breakdown stance. On cadence, explode hips violently forward-upward, shooting uppercuts through target"
      },
      {
        "desc": "Defender approaches runner in open field, aims eyes at the runner's thighs/hip, clamps arms tightly around thighs, and rolls laterally with momentum to bring runner down safely",
        "key": "Safety is paramount for 7U-10U. Emphasize taking the head completely out of the tackle ('eyes on the thighs'). Praise kids who wrap tight over those who try to bring big hits",
        "name": "Tackling: Hawk (Rugby) Roll Tackle"
      },
      {
        "name": "Tackling: Angle / Alley Tackle Drill",
        "desc": "Runner aims for pylon or sideline cone. Defender takes an inside-out angle to intersect runner's path, breaks down into swoop position, plants near foot, and drives shoulder through runner's near hip",
        "key": "Enforce stepping with the 'near foot' (the foot closest to the runner) right before contact to generate power and prevent reaching"
      },
      {
        "desc": "Align defender against a down-blocker with a RB running off-tackle. Defender strikes and sheds the down-blocker, maintains inside leverage, takes tight angle, and form tackles RB",
        "name": "Tackling: Tight Angle Tackle Drill",
        "key": "Stay square to the line of scrimmage while shedding the block to maintain the correct angle"
      },
      {
        "desc": "Ball carrier runs at half-speed along long edge of mat. Defender approaches on an angle, tracks hip, uses near foot, and completes full shoulder tackle taking runner safely down onto the mat",
        "key": "Great for building confidence in younger players learning how to safely take a runner to the ground",
        "name": "Tackling: Angle Tackle on Green Mat"
      },
      {
        "key": "Breaks down the tackle into isolated, controlled steps to build perfect muscle memory",
        "desc": "Boys face partners across a line. 1st whistle = plant near foot; 2nd whistle = strike near shoulder to breastplate; 3rd whistle = wrap cloth; 4th whistle = drive legs for 5 yards",
        "name": "Tackling: Tackle Fit Line"
      },
      {
        "key": "The sideline is the 12th defender. Never let the runner cut back inside toward the middle of the field",
        "desc": "Runner attempts to turn corner down sideline. Defender uses sideline as 12th defender, attacks outside shoulder, and forces runner out of bounds",
        "name": "Tackling: Sideline Pin-And-Squeeze Tackle"
      },
      {
        "name": "Tackling: Leverage Form Tackle (Ring Drill)",
        "desc": "Two lines facing each other 5 yards apart. Ball carrier jogs in place; tackler steps up, establishes inside leverage, and lifts through hips",
        "key": "Low man wins. Teaches leg drive and maintaining a wide, powerful base after contact"
      },
      {
        "desc": "Ball carrier runs at 45-degree angle across 10x10 grid. Defender starts opposite, takes pursuit angle, breaks down into swoop, targets near hip, clamps, and drives through",
        "key": "Intersect their path. Aim for the hip, not the shoulders",
        "name": "Tackling: Open-Field Angle Tackle (10x10 Grid)"
      },
      {
        "key": "Do not lunge. Buzz the feet, close the distance, and let the runner make the first move",
        "desc": "10x10 yard grid. Defender tracks an elusive runner, breaks down 2 yards away, and executes a safe open-field wrap",
        "name": "Tackling: Open Field Shimmy (Space)"
      },
      {
        "key": "Isolates the hip explosion and reinforces tackling low at the thigh level",
        "name": "Tackling: Thigh & Drive Tackle Drill (Kneeling to Standing)",
        "desc": "Start from kneeling position facing bag. Explode hips, strike bag with shoulder at thigh level, wrap arms, and drive feet forward to finish. Progress from kneeling to standing to moving player"
      },
      {
        "desc": "3 half-round dummies on ground creating 2 distinct running alleys. Ball carrier runs horizontally and chooses alley 1 or 2. Defender shuffles laterally across the bags, reads runner's commitment, swoops downhill into the hole, and makes thud tackle",
        "name": "Tackling: Fill Drill (Half-Rounds / 2 Alleys)",
        "key": "Add a lead blocker to work on shock & shed while maintaining gap integrity"
      },
      {
        "key": "Trains defenders to keep their eyes on the ball carrier while engaged with a blocker",
        "name": "Tackling: Thud, Read, Tackle Donut",
        "desc": "Defender comes up to engage blocker at thud tempo, reads coach rolling tackle donut left or right, sheds block violently, and attacks/tackles the rolling donut"
      },
      {
        "desc": "Divide into 4 groups. Rotate every 3-5 mins. Station 1: Strip drill. Station 2: Fumble recovery (fall on it). Station 3: Tip drill (INTs). Station 4: Punch-out from behind",
        "name": "Tackling: Turnover Circuit (4 Groups)",
        "key": "Make this a high-energy, fun circuit. Teach them to cover up a fumble in the fetal position rather than trying to scoop and run in heavy traffic"
      }
    ],
    "name": "💥 Tackling"
  },
  {
    "subfolders": [],
    "drills": [
      {
        "desc": "1. Coil: low balanced 3-point stance. 2. Uncoil: explosive upward hip explosion. 3. Fit: hands inside breastplate with thumbs up, elbows tucked. 4. Finish: drive legs forward through the whistle",
        "name": "Blocking: CUFF Blocking Progression",
        "key": "Hands must be inside. If hands land outside the shoulders, it's a holding penalty waiting to happen"
      },
      {
        "key": "Teaches the static power position. If the back is rounded, they will lose their balance and get pushed back",
        "name": "Blocking: Bridge Blocking Fit",
        "desc": "Pairs fit into bridge blocking position: wide triangle base, elbows in, arms off body, thumbs out, back arched to stand opponent up before feet churn"
      },
      {
        "name": "Blocking: Open-Field Blocking Drill (Space)",
        "desc": "Blocker starts in stance, takes pursuit angle to meet defender in open space, breaks down, swoops, fits hands/shoulder, and drives defender for 5 yards away from play direction",
        "key": "Do not go in like a missile. Break down to mirror the defender's lateral movements before engaging"
      },
      {
        "key": "Promotes physical toughness and shedding blocks in a confined space. Keep reps short and safe",
        "name": "Blocking: King of the Ring (Block Destruction / Leverage)",
        "desc": "Two players start in neutral position inside a 5-yard circle. On whistle, players engage using CUFF/Bridge blocking or shed moves. Winner uses low leverage and leg drive to push opponent out of ring"
      }
    ],
    "name": "🧱 Blocking"
  },
  {
    "drills": [
      {
        "desc": "Full kickoff team lines up across 40-yard line. On kicker approach/signal, sprint 40 yards downfield maintaining exactly 10 yards of lateral spacing between all players to prevent gaps in coverage",
        "name": "Special Teams: Kickoff Lane Spacing Drill",
        "key": "Young players often bunch up and chase the ball immediately. Train them to maintain their lanes until the returner commits"
      },
      {
        "key": "Do not block in the back. Wait for the coverage team to come to the wall, then engage.",
        "desc": "Front blockers sprint back 15 yards, turn, and form a tight wall shoulder-to-shoulder to block for returner",
        "name": "Special Teams: Kick Return Wedge"
      },
      {
        "key": "Focus strictly on the shield blocking technique",
        "desc": "Long snap to punter (12-15 yards). Linemen execute tight slide-and-fan protection, hold blocks for 2 seconds, and release downfield in designated coverage lanes",
        "name": "Special Teams: Punt Formation & Protection Install"
      },
      {
        "desc": "3 players form a shield 5 yards behind line. Step inside to seal gaps, absorb rushers, and hold for 2 seconds",
        "key": "Teach the shield players to step together and form a solid wall, absorbing contact rather than attacking upfield",
        "name": "Special Teams: Punt Shield Protection"
      },
      {
        "key": "Avoid the jam using a rip or swim move. Sprint to the hip of the returner and force a fair catch",
        "desc": "Gunner beats jam and forces fair catch",
        "name": "Special Teams: Gunner Release"
      },
      {
        "name": "Special Teams: Specialists Kicking & Holding",
        "desc": "Snapper, holder, and kicker work independently on snap trajectory, holder placement (laces out, finger on top), and kicker approach steps and follow-through",
        "key": "The holder controls the play. Catch the ball first, then smoothly transition it to the block/tee"
      },
      {
        "desc": "",
        "name": "Kickoff, Kick Return, Punt",
        "key": ""
      }
    ],
    "name": "🌟 Specials",
    "subfolders": []
  },
  {
    "subfolders": [],
    "name": "Tackle Circuit",
    "drills": [
      {
        "name": "Tackle Fit on Heavy Bag",
        "key": "",
        "desc": "Reinforce boys need to be leaning forward just before impact to deliver contact to offensive player"
      },
      {
        "key": "",
        "name": "Shed and Tackle Rolling Donut",
        "desc": ""
      },
      {
        "desc": "",
        "name": "Angle Tackle on Green Mat",
        "key": ""
      },
      {
        "key": "",
        "name": "Thigh and Roll Tackle on Half-Round",
        "desc": "Defender starts in defensive stance, explodes forward on whistle and makes a thigh and roll tackle on half-round.  Coach holds the half-round out to side."
      }
    ]
  },
  {
    "name": "Full Team/Installs",
    "subfolders": [],
    "drills": [
      {
        "desc": "\n\nReview transitions between 5-3 & 4-4",
        "name": "Chalk Talk over Water Break",
        "key": ""
      },
      {
        "key": "",
        "name": "Pursuit Angle Drill",
        "desc": "gold and blue run plays down the field v/ air Hurry Up"
      }
    ]
  },
  {
    "subfolders": [],
    "drills": [
      {
        "name": "DL",
        "desc": "",
        "key": ""
      },
      {
        "name": "DL & DEs",
        "desc": "",
        "key": ""
      },
      {
        "name": "LBs",
        "desc": "",
        "key": ""
      },
      {
        "key": "",
        "name": "CBs & Safeties",
        "desc": ""
      }
    ],
    "name": "Indy / Fundamentals"
  }
];

export const DEFAULT_PRACTICE_TEMPLATES: Record<string, PracticePeriod[]> = {
  "Standard Practice": [
    {
      time: 10,
      category: "📋 General",
      format: "static",
      stations: [
        {
          name: "Team Stretch & Dynamic Warm-Up",
          desc: "Dynamic stretching, knee tucks, bounding, calisthenics",
          coach: "",
          focus: "Flexibility, energy & focus"
        }
      ]
    },
    {
      time: 15,
      category: "⚡ (Warm-up, Agility and Conditioning)",
      format: "static",
      stations: [
        {
          name: "Agility Ladder & Footwork Circuit",
          desc: "Quick feet, shuffle, 5-yard sprints",
          coach: "",
          focus: "Speed & foot placement"
        }
      ]
    },
    {
      time: 20,
      category: "🏈 Offense",
      format: "rotating",
      stations: [
        {
          name: "QB / RB Mesh & Pass Routes",
          desc: "Hand-off timing, quick slant & out routes",
          coach: "",
          focus: "Ball security & timing"
        },
        {
          name: "OL Drive & Reach Blocking",
          desc: "Pad leverage, gap steps, punch technique",
          coach: "",
          focus: "First 6-inch step & pad level"
        }
      ]
    },
    {
      time: 20,
      category: "🛡️ Defense",
      format: "rotating",
      stations: [
        {
          name: "DL Shed & Pursuit Angles",
          desc: "Get-off, rip/swim moves, bag tackle",
          coach: "",
          focus: "Attack blocker, maintain gap"
        },
        {
          name: "LB / DB Zone Drops & Tackling",
          desc: "Cover-2 / Cover-3 pass drops & pursuit alleys",
          coach: "",
          focus: "Eyes on QB, break on throw"
        }
      ]
    },
    {
      time: 20,
      category: "💥 Tackling",
      format: "static",
      stations: [
        {
          name: "Form Tackling Circuit",
          desc: "Breakdown, near-foot strike, wrap & roll finish",
          coach: "",
          focus: "Safety, head placement & leg drive"
        }
      ]
    },
    {
      time: 25,
      category: "🏈 Offense",
      format: "static",
      stations: [
        {
          name: "Team 11-on-11 Scrimmage / Script Install",
          desc: "Live script install vs scout defense, two-minute drill",
          coach: "",
          focus: "Huddle speed, pre-snap alignment & execution"
        }
      ]
    }
  ],
  "Walkthrough / Light": [
    {
      time: 10,
      category: "📋 General",
      format: "static",
      stations: [
        {
          name: "Chalk Talk & Script Review",
          desc: "Whiteboard walk-through of weekly opponent tendencies",
          coach: "",
          focus: "Mental assignments & checks"
        }
      ]
    },
    {
      time: 20,
      category: "⚡ (Warm-up, Agility and Conditioning)",
      format: "static",
      stations: [
        {
          name: "Light Stretch & Footwork",
          desc: "No pads dynamic warm-up and foam rolling",
          coach: "",
          focus: "Mobility & recovery"
        }
      ]
    },
    {
      time: 30,
      category: "🏈 Offense",
      format: "static",
      stations: [
        {
          name: "Offensive Walkthrough vs Air",
          desc: "Slow speed install, motion timing, cadence calls",
          coach: "",
          focus: "Zero false starts, clean mesh"
        }
      ]
    },
    {
      time: 30,
      category: "🛡️ Defense",
      format: "static",
      stations: [
        {
          name: "Defensive Alignment Walkthrough",
          desc: "Gap fits, motion adjustment, secondary rotation",
          coach: "",
          focus: "Proper pre-snap communication"
        }
      ]
    }
  ],
  "Pre-Game Warmup & Routine": [
    {
      time: 15,
      category: "⚡ (Warm-up, Agility and Conditioning)",
      format: "static",
      stations: [
        {
          name: "Full Team Dynamic Warmup & Activation",
          desc: "Dynamic stretching, knee tucks, high knees, butt kicks, 10-yard build-up sprints",
          coach: "",
          focus: "Game readiness, muscle activation & joint mobility"
        }
      ]
    },
    {
      time: 15,
      category: "🏈 Offense",
      format: "rotating",
      stations: [
        {
          name: "QB / WR Passing Tree & Routes vs Air",
          desc: "Snaps, quick game, intermediate routes, timing & sidelines",
          coach: "",
          focus: "Throw on time, crisp cuts & secure catches"
        },
        {
          name: "OL / RB Run Fit & Mesh Warmup",
          desc: "Inside zone, dive mesh, gap footwork and first-step punch",
          coach: "",
          focus: "Clean handoffs & first step explosion"
        }
      ]
    },
    {
      time: 15,
      category: "🛡️ Defense",
      format: "rotating",
      stations: [
        {
          name: "DL Get-Off & Punch Shuck",
          desc: "Reaction to ball snap, violent punch, lockout and shed",
          coach: "",
          focus: "Fast twitch get-off, no offsides"
        },
        {
          name: "DB / LB Pursuit & Breakdown Angles",
          desc: "Angle of pursuit, breakdown, shuffle, tag off hip",
          coach: "",
          focus: "Proper angle to outside hip, leverage"
        }
      ]
    },
    {
      time: 15,
      category: "📋 General",
      format: "static",
      stations: [
        {
          name: "Special Teams & Opening Script Review",
          desc: "Kickoff, Kick Return, Punt alignment, call & walk through first 5 scripted plays",
          coach: "",
          focus: "Personnel groups, zero pre-snap penalties, game focus"
        }
      ]
    }
  ]
};

export const DEFAULT_GUIDES_TREE: PlaybookGuideTree = {
  "🛡️ Defense": {
    "4-4 Base Stack Liz vs 21 L": "",
    "4-4 Base Stack Rip vs 21 R": "",
    "4-4 Base Stack Liz vs 22 Twins R": "",
    "4-4 Base Stack Liz vs 11 Trick Trips Laser": "",
    "4-4 Base Stack Blow Sting Liz": "",
    "4-4 Double Dog 0 Liz": "",
    "4-4 Stunts Cross": "",
    "4-4 Stunts Fan": "",
    "4-4 Stunts Pinch": "",
    "5-3 Overshift Liz": "",
    "6-2 Goal Line Wall": "",
    "Defensive Tackles (DL)": "",
    "Defensive Ends (DE)": "",
    "Linebackers (LB)": "",
    "Defensive Backs (DB)": "",
    "Team Tackling & Circuits": ""
  },
  "🏈 Offense": {
    "Full Playbook": "",
    "Quarterbacks": "",
    "Running Backs": "",
    "Wide Receivers & TEs": "",
    "Offensive Line": "",
    "Team Offense & Install": ""
  },
  "📋 Defensive Schemes & Shells": {
    "4-4 Base Stack Liz vs 21 L": "",
    "4-4 Base Stack Rip vs 21 R": "",
    "4-4 Base Stack Liz vs 22 Twins R": "",
    "4-4 Base Stack Liz vs 11 Trick Trips Laser": "",
    "4-4 Base Stack Blow Sting Liz": "",
    "4-4 Double Dog 0 Liz": "",
    "4-4 Stunts Cross": "",
    "4-4 Stunts Fan": "",
    "4-4 Stunts Pinch": "",
    "5-3 Overshift Liz": "",
    "6-2 Goal Line Wall": ""
  },
  "🥋 Form Fit Tackling": {
    "Form Fit & Strike": "",
    "Angle & Open Field Pursuit": ""
  },
  "🧱 Blocking Technique": {
    "Drive & Reach Blocking": "",
    "Pass Protection Fundamentals": ""
  },
  "🌟 Special Teams": {
    "Special Teams (Kick/Punt)": "",
    "Kicking & Punting": ""
  },
  "🏃 Warm-Up & Conditioning": {
    "Dynamic Warm-Up": "",
    "Agility & Conditioning Circuits": ""
  }
};

export const DEFAULT_GUIDES_ORDER: PlaybookGuideOrder = {
  main: [
    "🛡️ Defense",
    "🏈 Offense",
    "📋 Defensive Schemes & Shells",
    "🥋 Form Fit Tackling",
    "🧱 Blocking Technique",
    "🌟 Special Teams",
    "🏃 Warm-Up & Conditioning"
  ],
  sub: {
    "🛡️ Defense": [
      "4-4 Base Stack Liz vs 21 L",
      "4-4 Base Stack Rip vs 21 R",
      "4-4 Base Stack Liz vs 22 Twins R",
      "4-4 Base Stack Liz vs 11 Trick Trips Laser",
      "4-4 Base Stack Blow Sting Liz",
      "4-4 Double Dog 0 Liz",
      "4-4 Stunts Cross",
      "4-4 Stunts Fan",
      "4-4 Stunts Pinch",
      "5-3 Overshift Liz",
      "6-2 Goal Line Wall",
      "Defensive Tackles (DL)",
      "Defensive Ends (DE)",
      "Linebackers (LB)",
      "Defensive Backs (DB)",
      "Team Tackling & Circuits"
    ],
    "🏈 Offense": [
      "Full Playbook",
      "Quarterbacks",
      "Running Backs",
      "Wide Receivers & TEs",
      "Offensive Line",
      "Team Offense & Install"
    ],
    "📋 Defensive Schemes & Shells": [
      "4-4 Base Stack Liz vs 21 L",
      "4-4 Base Stack Rip vs 21 R",
      "4-4 Base Stack Liz vs 22 Twins R",
      "4-4 Base Stack Liz vs 11 Trick Trips Laser",
      "4-4 Base Stack Blow Sting Liz",
      "4-4 Double Dog 0 Liz",
      "4-4 Stunts Cross",
      "4-4 Stunts Fan",
      "4-4 Stunts Pinch",
      "5-3 Overshift Liz",
      "6-2 Goal Line Wall"
    ],
    "🥋 Form Fit Tackling": ["Form Fit & Strike", "Angle & Open Field Pursuit"],
    "🧱 Blocking Technique": ["Drive & Reach Blocking", "Pass Protection Fundamentals"],
    "🌟 Special Teams": ["Special Teams (Kick/Punt)", "Kicking & Punting"],
    "🏃 Warm-Up & Conditioning": ["Dynamic Warm-Up", "Agility & Conditioning Circuits"]
  }
};

export const DEFAULT_SAVED_COACHES: string[] = [];

export const DEFAULT_SAVED_COACHES_BY_TEAM: Record<string, string[]> = {};

export const DEFAULT_TEAM_COACHES: StaffCoach[] = [];

export const MASTER_PLAY_LIBRARY: string[] = [
  "21 L 26 DIVE",
  "21 L 37 ZONE",
  "21 L FAKE 24 DIVE 37 ZONE",
  "21 L 39 TOSS SWEEP",
  "21 L 39 TOSS SWEEP Z CRACK",
  "21 L 19 KEEP",
  "21 R 19 BOOT",
  "21 L 38 POWER",
  "21 R 38 COUNTER",
  "21 R TWINS L Z BUBBLE",
  "21 R TWINS L Z SMOKE",
  "21 L 38 POWER PASS",
  "21 R 24 DIVE",
  "21 R 33 ZONE",
  "21 R FAKE 26 DIVE 33 ZONE",
  "21 R 31 TOSS SWEEP",
  "21 R 31 TOSS SWEEP Z CRACK",
  "21 R 11 KEEP",
  "21 L 11 BOOT",
  "21 R 32 POWER",
  "21 L 32 COUNTER",
  "21 L TWINS R Z BUBBLE",
  "21 L TWINS R Z SMOKE",
  "21 R 32 POWER PASS",
  "21 L TWINS R GO-OUT",
  "32 L 26 DIVE",
  "32 L 47 ZONE",
  "32 L FAKE 24 DIVE 47 ZONE",
  "32 L 49 TOSS SWEEP",
  "32 R 48 COUNTER",
  "32 L 19 KEEP",
  "32 R 19 BOOT",
  "11 L W JET",
  "11 L BUBBLE PASS",
  "11 L GO-OUT",
  "11 L 18 POWER",
  "11 L 26 DIVE",
  "11 L 19 KEEP",
  "32 R 24 DIVE",
  "32 R 33 ZONE",
  "32 R FAKE 26 DIVE 33 ZONE",
  "32 R 31 TOSS SWEEP",
  "32 L 32 COUNTER",
  "32 R 11 KEEP",
  "32 L 11 BOOT",
  "11 R W JET",
  "11 R BUBBLE PASS",
  "11 R GO-OUT",
  "11 R 12 POWER",
  "11 R 24 DIVE",
  "11 R 11 KEEP",
  "24 Dive",
  "25 Trap",
  "Sweep Right",
  "Bootleg Pass",
  "Screen Pass",
  "12 Dive (Lead Right)",
  "13 Dive (Lead Left)",
  "Sweep 28 Right",
  "Sweep 29 Left",
  "Iso Power 36",
  "Counter 21 Reverse"
];

export const DEFAULT_SCHEDULE_EVENTS: ScheduleEvent[] = [
  {
    id: "ts_evt_1",
    teamId: "team_10u",
    type: "practice",
    title: "Free Clinic w/ Coach Gangemi",
    week: "pre-1",
    date: "2026-07-16",
    startTime: "18:00",
    endTime: "19:30",
    location: "Middle School Grass (between High School and Middle School) Baseball Outfield",
    locationType: "home",
    arrivalMinutesBefore: 15,
    focusOrNotes: "Arrival Time: 5:45 PM. Free clinic fundamentals & skills.",
    createdAt: 1721100000000,
    lastEdited: 1721100000000,
  },
  {
    id: "ts_evt_2",
    teamId: "team_10u",
    type: "practice",
    title: "First Day of Practice",
    week: "pre-1",
    date: "2026-08-03",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    focusOrNotes: "Arrival Time: 5:15 PM. First official day of summer practice.",
    createdAt: 1722700000000,
    lastEdited: 1722700000000,
  },
  {
    id: "ts_evt_3",
    teamId: "team_10u",
    type: "practice",
    title: "Practice",
    week: "pre-1",
    date: "2026-08-04",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    createdAt: 1722800000000,
    lastEdited: 1722800000000,
  },
  {
    id: "ts_evt_4",
    teamId: "team_10u",
    type: "practice",
    title: "DeMatteo Clinic",
    week: "pre-1",
    date: "2026-08-05",
    startTime: "17:30",
    endTime: "19:00",
    location: "Mahopac High School - Stadium Turf",
    locationType: "home",
    arrivalMinutesBefore: 15,
    focusOrNotes: "Arrival Time: 5:15 PM @ Mahopac High School Turf.",
    createdAt: 1722900000000,
    lastEdited: 1722900000000,
  },
  {
    id: "ts_evt_5",
    teamId: "team_10u",
    type: "meeting",
    title: "Equipment Pick Up",
    week: "pre-1",
    date: "2026-08-06",
    startTime: "16:00",
    endTime: "17:00",
    location: "Mahopac High School - EQUIPMENT TRAILERS (in back)",
    locationType: "home",
    arrivalMinutesBefore: 0,
    focusOrNotes: "Please make sure to bring check so you can pick up your equipment!",
    createdAt: 1723000000000,
    lastEdited: 1723000000000,
  },
  {
    id: "ts_evt_6",
    teamId: "team_10u",
    type: "practice",
    title: "Practice",
    week: "pre-1",
    date: "2026-08-06",
    startTime: "18:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    createdAt: 1723010000000,
    lastEdited: 1723010000000,
  },
  {
    id: "ts_evt_7",
    teamId: "team_10u",
    type: "practice",
    title: "Practice",
    week: "pre-2",
    date: "2026-08-10",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    createdAt: 1723300000000,
    lastEdited: 1723300000000,
  },
  {
    id: "ts_evt_8",
    teamId: "team_10u",
    type: "practice",
    title: "Practice",
    week: "pre-2",
    date: "2026-08-11",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    createdAt: 1723400000000,
    lastEdited: 1723400000000,
  },
  {
    id: "ts_evt_9",
    teamId: "team_10u",
    type: "practice",
    title: "Practice",
    week: "pre-2",
    date: "2026-08-12",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    createdAt: 1723500000000,
    lastEdited: 1723500000000,
  },
  {
    id: "ts_evt_10",
    teamId: "team_10u",
    type: "practice",
    title: "Practice",
    week: "pre-2",
    date: "2026-08-13",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    createdAt: 1723600000000,
    lastEdited: 1723600000000,
  },
  {
    id: "ts_evt_11",
    teamId: "team_10u",
    type: "practice",
    title: "Practice",
    week: "pre-3",
    date: "2026-08-17",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    createdAt: 1723900000000,
    lastEdited: 1723900000000,
  },
  {
    id: "ts_evt_12",
    teamId: "team_10u",
    type: "practice",
    title: "Practice",
    week: "pre-3",
    date: "2026-08-18",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    createdAt: 1724000000000,
    lastEdited: 1724000000000,
  },
  {
    id: "ts_evt_13",
    teamId: "team_10u",
    type: "practice",
    title: "Practice",
    week: "pre-3",
    date: "2026-08-19",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    createdAt: 1724100000000,
    lastEdited: 1724100000000,
  },
  {
    id: "ts_evt_14",
    teamId: "team_10u",
    type: "practice",
    title: "Practice",
    week: "pre-4",
    date: "2026-08-24",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    createdAt: 1724500000000,
    lastEdited: 1724500000000,
  },
  {
    id: "evt_pre_p1",
    teamId: "team_10u",
    type: "practice",
    title: "Preseason Conditioning & Stance Starts #1",
    week: "pre-4",
    date: "2026-08-25",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    linkedPracticePlanId: "p_pre_1",
    focusOrNotes: "Arrival Time: 5:15 PM. Conditioning, stance & starts, 11-person alignments.",
    createdAt: 1724600000000,
    lastEdited: 1724600000000,
  },
  {
    id: "ts_evt_15",
    teamId: "team_10u",
    type: "practice",
    title: "Practice",
    week: "pre-4",
    date: "2026-08-26",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    createdAt: 1724700000000,
    lastEdited: 1724700000000,
  },
  {
    id: "evt_pre_p2",
    teamId: "team_10u",
    type: "practice",
    title: "Pursuit Angles & Base Offensive Install",
    week: "pre-4",
    date: "2026-08-27",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    linkedPracticePlanId: "p_pre_2",
    focusOrNotes: "Arrival Time: 5:15 PM. Tackling circuit, pursuit angles, offensive install.",
    createdAt: 1724750000000,
    lastEdited: 1724750000000,
  },
  {
    id: "evt_ts_scr_metlife",
    teamId: "team_10u",
    type: "scrimmage",
    title: "Scrimmage @ MetLife Stadium vs Brewster",
    week: "pre-4",
    date: "2026-08-28",
    startTime: "14:30",
    endTime: "16:30",
    location: "MetLife Stadium",
    locationType: "neutral",
    opponent: "Brewster",
    arrivalMinutesBefore: 60,
    focusOrNotes: "Scrimmage vs. Brewster. Must Check-in @ Moody's Gate at 2:00 PM (Arrival 1:30 PM).",
    createdAt: 1724800000000,
    lastEdited: 1724800000000,
  },
  {
    id: "evt_w1_p0",
    teamId: "team_10u",
    type: "practice",
    title: "Week 1 Prep - Monday Installation & Fundamentals",
    week: "1",
    date: "2026-08-31",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    focusOrNotes: "Full Pads. Monday game-week install: Suffern front keys, punt coverage lanes, 11-person offense wristband test.",
    linkedPracticePlanId: "p_pre_monday_831",
    createdAt: 1724900000000,
    lastEdited: 1724900000000,
  },
  {
    id: "evt_w1_p1",
    teamId: "team_10u",
    type: "practice",
    title: "Week 1 Shells & Fundamentals / Redzone Prep",
    week: "1",
    date: "2026-09-01",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    linkedPracticePlanId: "p_pre_3",
    focusOrNotes: "Focus on 24 Dive, 25 Trap, and DL gap penetration keys vs Suffern.",
    createdAt: 1725000000000,
    lastEdited: 1725000000000,
  },
  {
    id: "ts_evt_16",
    teamId: "team_10u",
    type: "practice",
    title: "Practice",
    week: "1",
    date: "2026-09-02",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    createdAt: 1725050000000,
    lastEdited: 1725050000000,
  },
  {
    id: "evt_w1_p2",
    teamId: "team_10u",
    type: "practice",
    title: "Week 1 Full Padded Scrimmage Dress Rehearsal",
    week: "1",
    date: "2026-09-03",
    startTime: "17:30",
    endTime: "20:00",
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    locationType: "home",
    arrivalMinutesBefore: 15,
    linkedPracticePlanId: "p_pre_4",
    focusOrNotes: "Full Pads. Wristband speed test, kickoff coverage, field goal block.",
    createdAt: 1725100000000,
    lastEdited: 1725100000000,
  },
  {
    id: "evt_g1",
    teamId: "team_10u",
    type: "game",
    title: "Game #1 @ Suffern",
    week: "1",
    date: "2026-09-06",
    startTime: "12:00",
    endTime: "14:15",
    location: "Suffern Middle School (80 Hemion Rd, Suffern NY)",
    locationType: "away",
    opponent: "Suffern",
    uniform: "White Away Jerseys",
    arrivalMinutesBefore: 90,
    linkedPracticePlanId: "p_g1_pregame",
    preGamePlanId: "p_g1_pregame",
    focusOrNotes: "Regular Season Opener! Arrival Time: 10:30 AM at Suffern Middle School.",
    createdAt: 1725200000000,
    lastEdited: 1725200000000,
  },
  {
    id: "evt_w2_p1",
    teamId: "team_10u",
    type: "practice",
    title: "Week 2 - Yorktown Defense & Tackling",
    week: "2",
    date: "2026-09-08",
    startTime: "17:30",
    endTime: "19:00",
    location: "Crane Road",
    locationType: "home",
    arrivalMinutesBefore: 15,
    linkedPracticePlanId: "p_w2_1",
    focusOrNotes: "Full Pads. Contain drills and tackling vs Yorktown.",
    createdAt: 1725300000000,
    lastEdited: 1725300000000,
  },
  {
    id: "evt_w2_p2",
    teamId: "team_10u",
    type: "practice",
    title: "Week 2 - Redzone Execution & 2-Pt Plays",
    week: "2",
    date: "2026-09-10",
    startTime: "17:30",
    endTime: "19:00",
    location: "Crane Road",
    locationType: "home",
    arrivalMinutesBefore: 15,
    linkedPracticePlanId: "p_w2_2",
    focusOrNotes: "Goal line offense, tight formations, 2-minute drill hurry up.",
    createdAt: 1725400000000,
    lastEdited: 1725400000000,
  },
  {
    id: "evt_g2",
    teamId: "team_10u",
    type: "game",
    title: "Game #2 vs Yorktown Huskers",
    week: "2",
    date: "2026-09-13",
    startTime: "12:00",
    endTime: "14:15",
    location: "Mahopac High School - Stadium Turf",
    locationType: "home",
    opponent: "Yorktown Huskers",
    uniform: "Gold Home Jerseys",
    arrivalMinutesBefore: 90,
    focusOrNotes: "Home Opener! Arrival Time: 10:30 AM at Mahopac High School Stadium Turf.",
    createdAt: 1725500000000,
    lastEdited: 1725500000000,
  },
  {
    id: "evt_g3",
    teamId: "team_10u",
    type: "game",
    title: "Game #3 vs Shrub Oak",
    week: "3",
    date: "2026-09-20",
    startTime: "12:00",
    endTime: "14:15",
    location: "Mahopac High School - Stadium Turf",
    locationType: "home",
    opponent: "Shrub Oak",
    uniform: "Gold Home Jerseys",
    arrivalMinutesBefore: 90,
    focusOrNotes: "Arrival Time: 10:30 AM at Mahopac High School Stadium Turf.",
    createdAt: 1725600000000,
    lastEdited: 1725600000000,
  },
  {
    id: "evt_g4",
    teamId: "team_10u",
    type: "game",
    title: "Game #4 @ Carmel Rams",
    week: "4",
    date: "2026-09-27",
    startTime: "13:00",
    endTime: "15:15",
    location: "Carmel High School (30 Fair St, Carmel NY)",
    locationType: "away",
    opponent: "Carmel Rams",
    uniform: "White Away Jerseys",
    arrivalMinutesBefore: 90,
    focusOrNotes: "Arrival Time: 11:30 AM at Carmel High School.",
    createdAt: 1725700000000,
    lastEdited: 1725700000000,
  },
  {
    id: "evt_g5",
    teamId: "team_10u",
    type: "game",
    title: "Game #5 vs Wappingers Wildcats",
    week: "5",
    date: "2026-10-04",
    startTime: "15:00",
    endTime: "17:15",
    location: "Mahopac High School - Stadium Turf",
    locationType: "home",
    opponent: "Wappingers Wildcats",
    uniform: "Gold Home Jerseys",
    arrivalMinutesBefore: 90,
    focusOrNotes: "Arrival Time: 1:30 PM at Mahopac High School Stadium Turf.",
    createdAt: 1725800000000,
    lastEdited: 1725800000000,
  },
  {
    id: "evt_g6",
    teamId: "team_10u",
    type: "game",
    title: "Game #6 @ Brewster",
    week: "6",
    date: "2026-10-11",
    startTime: "15:00",
    endTime: "17:15",
    location: "Brewster High School Field (50 Foggintown Rd, Brewster NY)",
    locationType: "away",
    opponent: "Brewster",
    uniform: "White Away Jerseys",
    arrivalMinutesBefore: 90,
    focusOrNotes: "Arrival Time: 1:30 PM at Brewster High School Field.",
    createdAt: 1725900000000,
    lastEdited: 1725900000000,
  },
  {
    id: "evt_g7",
    teamId: "team_10u",
    type: "game",
    title: "Game #7 vs Somers Tuskers",
    week: "7",
    date: "2026-10-18",
    startTime: "14:00",
    endTime: "16:15",
    location: "Mahopac High School - Stadium Turf",
    locationType: "home",
    opponent: "Somers Tuskers",
    uniform: "Gold Home Jerseys",
    arrivalMinutesBefore: 90,
    focusOrNotes: "Arrival Time: 12:30 PM at Mahopac High School Stadium Turf.",
    createdAt: 1726000000000,
    lastEdited: 1726000000000,
  },
  {
    id: "evt_g8",
    teamId: "team_10u",
    type: "game",
    title: "Game #8 vs TBD",
    week: "8",
    date: "2026-10-25",
    startTime: "15:20",
    endTime: "17:30",
    location: "TBD",
    locationType: "home",
    opponent: "TBD",
    uniform: "Gold Home / White Away (TBD)",
    arrivalMinutesBefore: 60,
    focusOrNotes: "Arrival Time: 3:20 PM.",
    createdAt: 1726100000000,
    lastEdited: 1726100000000,
  }
];

export const DEFAULT_SEASON_CONFIG: SeasonConfig = {
  preseasonWeeksCount: 4,
  preseasonWeekKeys: ['pre-1', 'pre-2', 'pre-3', 'pre-4'],
  regularSeasonWeeksCount: 8,
  hasPlayoffs: true,
  hasChampionship: true,
  customWeekLabels: {
    '0': 'Pre-Season Week 1',
    'pre-1': 'Pre-Season Week 1',
    'pre-2': 'Pre-Season Week 2',
    'pre-3': 'Pre-Season Week 3',
    'pre-4': 'Pre-Season Week 4',
    '1': 'Week 1',
    '2': 'Week 2',
    '3': 'Week 3',
    '4': 'Week 4',
    '5': 'Week 5',
    '6': 'Week 6',
    '7': 'Week 7',
    '8': 'Week 8',
    'playoffs': 'Playoffs',
    'championship': 'Championship',
  }
};

const ALL_10U_ROSTER_NUMS = [
  "2", "4", "6", "7", "8", "10", "11", "12", "13", "15", "17", "19", "20", "21", "22", "27", "33", "34", "40", "44", "48", "50", "52", "56", "66", "99"
];

export const DEFAULT_ATTENDANCE_LOGS: AttendanceRecord[] = [
  // Pre-Season Week 1 (Starts Monday 8/3)
  {
    id: "att_pre_1_1",
    scheduleEventId: "ts_evt_2",
    date: "2026-08-03",
    week: "pre-1",
    title: "First Day of Practice",
    sessionType: "conditioning",
    hours: 2.5,
    location: "Main Field",
    presentPlayerNums: ALL_10U_ROSTER_NUMS.filter((n) => n !== "34" && n !== "44"),
    absentPlayerNums: ["34", "44"],
    notes: "Mandatory Heat & Acclimatization conditioning. Helmets, tees & shorts only.",
    timestamp: 1722690000000,
  },
  {
    id: "att_pre_1_2",
    scheduleEventId: "ts_evt_3",
    date: "2026-08-04",
    week: "pre-1",
    title: "Practice",
    sessionType: "conditioning",
    hours: 2.5,
    location: "Main Field",
    presentPlayerNums: ALL_10U_ROSTER_NUMS.filter((n) => n !== "22"),
    absentPlayerNums: ["22"],
    notes: "Day 2 conditioning, individual fundamentals and sprint mechanics.",
    timestamp: 1722776400000,
  },
  {
    id: "att_pre_1_3",
    scheduleEventId: "ts_evt_4",
    date: "2026-08-05",
    week: "pre-1",
    title: "DeMatteo Clinic",
    sessionType: "conditioning",
    hours: 1.5,
    location: "Main Field",
    presentPlayerNums: [...ALL_10U_ROSTER_NUMS],
    absentPlayerNums: [],
    notes: "DeMatteo blocking & pursuit angles clinic. Full team attendance.",
    timestamp: 1722862800000,
  },
  {
    id: "att_pre_1_4",
    scheduleEventId: "ts_evt_6",
    date: "2026-08-06",
    week: "pre-1",
    title: "Practice",
    sessionType: "conditioning",
    hours: 1.5,
    location: "Main Field",
    presentPlayerNums: ALL_10U_ROSTER_NUMS.filter((n) => n !== "44"),
    absentPlayerNums: ["44"],
    notes: "Week 1 review, base alignments and agility circuit.",
    timestamp: 1722949200000,
  },

  // Pre-Season Week 2 (Starts Monday 8/10)
  {
    id: "att_pre_2_1",
    scheduleEventId: "ts_evt_7",
    date: "2026-08-10",
    week: "pre-2",
    title: "Practice",
    sessionType: "conditioning",
    hours: 2.5,
    location: "Main Field",
    presentPlayerNums: [...ALL_10U_ROSTER_NUMS],
    absentPlayerNums: [],
    notes: "Conditioning completion session. Regular attendees clear 10h threshold for pads.",
    timestamp: 1723294800000,
  },
  {
    id: "att_pre_2_2",
    scheduleEventId: "ts_evt_8",
    date: "2026-08-11",
    week: "pre-2",
    title: "Practice",
    sessionType: "padded",
    hours: 2.5,
    location: "Main Field",
    presentPlayerNums: [...ALL_10U_ROSTER_NUMS],
    absentPlayerNums: [],
    playerSessionTypes: {
      "34": "conditioning",
      "44": "conditioning",
    },
    notes: "First padded contact session for cleared players. Players 34, 44 on conditioning catch-up.",
    timestamp: 1723381200000,
  },
  {
    id: "att_pre_2_3",
    scheduleEventId: "ts_evt_9",
    date: "2026-08-12",
    week: "pre-2",
    title: "Practice",
    sessionType: "padded",
    hours: 2.5,
    location: "Main Field",
    presentPlayerNums: [...ALL_10U_ROSTER_NUMS],
    absentPlayerNums: [],
    playerSessionTypes: {
      "44": "conditioning",
    },
    notes: "Padded contact tackling circuit. Player 44 continues conditioning catch-up.",
    timestamp: 1723467600000,
  },
  {
    id: "att_pre_2_4",
    scheduleEventId: "ts_evt_10",
    date: "2026-08-13",
    week: "pre-2",
    title: "Practice",
    sessionType: "padded",
    hours: 2.5,
    location: "Main Field",
    presentPlayerNums: [...ALL_10U_ROSTER_NUMS],
    absentPlayerNums: [],
    playerSessionTypes: {
      "44": "conditioning",
    },
    notes: "Full team team session. Player 44 completes 10h conditioning requirement.",
    timestamp: 1723554000000,
  },

  // Pre-Season Week 3 (Starts Monday 8/17)
  {
    id: "att_pre_3_1",
    scheduleEventId: "ts_evt_11",
    date: "2026-08-17",
    week: "pre-3",
    title: "Practice",
    sessionType: "padded",
    hours: 2.5,
    location: "Main Field",
    presentPlayerNums: ALL_10U_ROSTER_NUMS.filter((n) => n !== "8"),
    absentPlayerNums: ["8"],
    notes: "Padded team session. Cleared players reach 10h contact threshold for scrimmages.",
    timestamp: 1723903200000,
  },

  // Regular Season Week 1 (Starts Monday 8/31)
  {
    id: "att_w1_1",
    scheduleEventId: "evt_w1_p0",
    date: "2026-08-31",
    week: "1",
    title: "Week 1 Prep - Monday Installation & Fundamentals",
    sessionType: "padded",
    hours: 2.5,
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    presentPlayerNums: ALL_10U_ROSTER_NUMS.filter((n) => n !== "34" && n !== "22"),
    absentPlayerNums: ["34", "22"],
    notes: "Monday game-week install: Suffern front keys, punt coverage lanes, offensive wristband test.",
    timestamp: 1725118200000,
  },
  {
    id: "att_w1_2",
    scheduleEventId: "evt_w1_p1",
    date: "2026-09-01",
    week: "1",
    title: "Week 1 Shells & Fundamentals / Redzone Prep",
    sessionType: "padded",
    hours: 2.0,
    location: "Jimmy McDonough Memorial Park (Crane Rd) - Upper Field Behind the Skate Park",
    presentPlayerNums: ALL_10U_ROSTER_NUMS.filter((n) => n !== "17" && n !== "22" && n !== "44"),
    absentPlayerNums: ["17", "22", "44"],
    notes: "Focus on 24 Dive, 25 Trap, and DL gap penetration keys vs Suffern.",
    timestamp: 1725204600000,
  },
];

export const DEFAULT_INITIAL_PRACTICES: PracticePlan[] = [
  {
    id: "p_pre_1",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Preseason Wk 1",
    dayFolder: "Tuesday 8/25",
    date: "2026-08-25",
    title: "Preseason Conditioning & Stance Starts #1",
    location: "Crane Road",
    periods: [
      {
        time: 10,
        category: "📋 General",
        format: "static",
        stations: [
          {
            name: "Team Dynamic Warm-Up & Stretches",
            desc: "High knees, butt kicks, carioca, ankle mobility, team cheer.",
            coach: "",
            focus: "Energy, team cadence, flexibility"
          }
        ]
      },
      {
        time: 20,
        category: "⚡ (Warm-up, Agility and Conditioning)",
        format: "static",
        stations: [
          {
            name: "Agility Ladder & 5-10-5 Pro Shuttle",
            desc: "2-in-2-out, icky shuffle, quick deceleration and change of direction.",
            coach: "",
            focus: "Low center of gravity, light fast feet"
          }
        ]
      },
      {
        time: 20,
        category: "🏈 Offense",
        format: "rotating",
        stations: [
          {
            name: "QB & RB Snap / Mesh Exchange",
            desc: "Under center snap mechanics, 3-step drop, secure mesh handoff.",
            coach: "",
            focus: "Zero fumbles, secure top elbow pocket"
          },
          {
            name: "OL Stance, Get-Off & 6-Inch Power Step",
            desc: "3-point stance alignment, first 6-inch drive step into sled.",
            coach: "",
            focus: "Wide base, low pads, thumbs up punch"
          }
        ]
      },
      {
        time: 20,
        category: "🛡️ Defense",
        format: "rotating",
        stations: [
          {
            name: "DL Stance & First Step Get-Off",
            desc: "Explode on ball movement, strike bag with inside hands, maintain gap integrity.",
            coach: "",
            focus: "Eyes on ball, explosive hips"
          },
          {
            name: "LB / DB Stance & Lateral Shuffle",
            desc: "Athletic breakdown stance, downhill plant, mirror ball movement.",
            coach: "",
            focus: "Square shoulders, avoid crossing feet"
          }
        ]
      },
      {
        time: 20,
        category: "💥 Tackling",
        format: "static",
        stations: [
          {
            name: "Heads-Up / Seahawk Leverage Form Circuit",
            desc: "Breakdown -> Buzz feet -> Near foot strike -> Wrap & squeeze dummy to ground.",
            coach: "",
            focus: "Safety first: head out of the tackle, eyes up"
          }
        ]
      }
    ]
  },
  {
    id: "p_pre_2",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Preseason Wk 1",
    dayFolder: "Thursday 8/27",
    date: "2026-08-27",
    title: "Pursuit Angles & Base Offensive Install",
    location: "Crane Road",
    periods: [
      {
        time: 10,
        category: "📋 General",
        format: "static",
        stations: [
          {
            name: "Team Dynamic Warm-Up",
            desc: "Progressive running, leg swings, arm circles, team break.",
            coach: "",
            focus: "Focus and tempo"
          }
        ]
      },
      {
        time: 25,
        category: "🏈 Offense",
        format: "rotating",
        stations: [
          {
            name: "Inside Zone / 24 Dive Timing",
            desc: "FB kick-out block, RB patience and cut off guard's hip.",
            coach: "",
            focus: "Hitting the designated hole with speed"
          },
          {
            name: "Pass Protection & Footwork",
            desc: "Kick slide, punch timing, post-foot plant.",
            coach: "",
            focus: "Balance and posture"
          }
        ]
      },
      {
        time: 25,
        category: "🛡️ Defense",
        format: "rotating",
        stations: [
          {
            name: "Defense Pursuit Drill (Alley Runs)",
            desc: "All 11 players break on ball flight, take proper outside/inside pursuit lanes.",
            coach: "",
            focus: "Containment and relentless hustle"
          }
        ]
      },
      {
        time: 30,
        category: "📋 General",
        format: "static",
        stations: [
          {
            name: "Team Offense 11-on-Air Script Review",
            desc: "Run 10 core plays on air with cadence, shift motions, and huddle break.",
            coach: "",
            focus: "Zero pre-snap penalties, crisp execution"
          }
        ]
      }
    ]
  },
  {
    id: "p_pre_monday_831",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 1",
    dayFolder: "Monday 8/31",
    date: "2026-08-31",
    title: "Week 1 Monday Installation & Base Fundamentals",
    location: "Crane Road",
    periods: [
      {
        time: 10,
        category: "📋 General",
        format: "static",
        stations: [
          {
            name: "Dynamic Warmup & Team Breakdown",
            desc: "High knees, hip openers, form runs, kickoff team cadence call.",
            coach: "",
            focus: "High tempo, focus, team discipline"
          }
        ]
      },
      {
        time: 20,
        category: "⚡ (Warm-up, Agility and Conditioning)",
        format: "static",
        stations: [
          {
            name: "Foot Fire & Reaction Tackling Pad",
            desc: "Quick chop feet into rapid strike on padded shield with proper leverage.",
            coach: "",
            focus: "Eyes up, shoulder strike, wrap and squeeze"
          }
        ]
      },
      {
        time: 25,
        category: "🏈 Offense",
        format: "rotating",
        stations: [
          {
            name: "11-Person Base Scheme & Wristband Installation",
            desc: "24 Dive, 25 Trap, and Sweep installation with wristband number checks.",
            coach: "",
            focus: "Rapid huddle break and clean handoff mesh"
          },
          {
            name: "Offensive Line Drive & Reach Blocks",
            desc: "Steps for gap control and seal blocks against Carmel 4-man front.",
            coach: "",
            focus: "Wide base, low pad level, hand placement"
          }
        ]
      },
      {
        time: 20,
        category: "🛡️ Defense",
        format: "rotating",
        stations: [
          {
            name: "DL & LB Gap Integrity & Pursuit Flow",
            desc: "Keying guards, shooting correct gaps, outside containment.",
            coach: "",
            focus: "Never lose outside leverage, fast lateral flow"
          }
        ]
      },
      {
        time: 15,
        category: "🏈 Special Teams",
        format: "static",
        stations: [
          {
            name: "Punt Coverage Lanes & Specialist Timing",
            desc: "Gunner release off line, lane discipline, secure snap-to-kick in 2.0s.",
            coach: "",
            focus: "Sprint to returner, breakdown inside 5 yards"
          }
        ]
      }
    ]
  },
  {
    id: "p_pre_3",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 1",
    dayFolder: "Tuesday 9/01",
    date: "2026-09-01",
    title: "Week 1 Shells & Fundamentals / Redzone Prep",
    location: "Crane Road",
    periods: [
      {
        time: 15,
        category: "⚡ (Warm-up, Agility and Conditioning)",
        format: "static",
        stations: [
          {
            name: "Dynamic Stretch & Foot Fire",
            desc: "Fast feet reaction drill on whistle.",
            coach: "",
            focus: "Reaction time"
          }
        ]
      },
      {
        time: 30,
        category: "🏈 Offense",
        format: "rotating",
        stations: [
          {
            name: "Sweep 28 Right & Reach Blocks",
            desc: "PST reach block, guard seal, RB accelerate to sideline numbers.",
            coach: "",
            focus: "Edge speed"
          },
          {
            name: "WR Stalk Blocking & Routes",
            desc: "Mirror DB, mirror hips, drive block on whistle.",
            coach: "",
            focus: "Effort without holding"
          }
        ]
      },
      {
        time: 30,
        category: "🛡️ Defense",
        format: "rotating",
        stations: [
          {
            name: "Cover 2 & Cover 3 Zone Drops",
            desc: "DBs backpedal to deep third/half, rally on thrown football.",
            coach: "",
            focus: "Eye on QB, break on release"
          }
        ]
      },
      {
        time: 15,
        category: "🎯 Special Teams",
        format: "static",
        stations: [
          {
            name: "Kickoff & Kickoff Return Alignment",
            desc: "Lanes coverage, avoid wedge block, safety touchback protocol.",
            coach: "",
            focus: "Stay in designated running lane"
          }
        ]
      }
    ]
  },
  {
    id: "p_pre_4",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 1",
    dayFolder: "Thursday 9/03",
    date: "2026-09-03",
    title: "Week 1 Full Padded Scrimmage Dress Rehearsal",
    location: "Crane Road",
    periods: [
      {
        time: 15,
        category: "⚡ (Warm-up, Agility and Conditioning)",
        format: "static",
        stations: [
          {
            name: "Team Warmup & Calisthenics",
            desc: "Full pre-game warm-up progression.",
            coach: "",
            focus: "Game day tempo"
          }
        ]
      },
      {
        time: 25,
        category: "🏈 Offense",
        format: "static",
        stations: [
          {
            name: "Goal Line & Short Yardage Package",
            desc: "I-Formation Heavy, Power 36, Wedge 0.",
            coach: "",
            focus: "Low pad level, push the pile"
          }
        ]
      },
      {
        time: 25,
        category: "🛡️ Defense",
        format: "static",
        stations: [
          {
            name: "Goal Line Stand & Blitz Package",
            desc: "A-gap blitz, pinch tackles, prevent push.",
            coach: "",
            focus: "Penetration and secure tackle"
          }
        ]
      },
      {
        time: 25,
        category: "⚔️ Practice / Scrimmage",
        format: "static",
        stations: [
          {
            name: "Live 11-on-11 Controlled Scrimmage",
            desc: "Offense vs Defense 15-play situational scrimmage with referee whistle.",
            coach: "",
            focus: "Game speed execution and player rotations"
          }
        ]
      }
    ]
  },
  {
    id: "p_g1_pregame",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 1",
    dayFolder: "Sunday 9/06",
    date: "2026-09-06",
    startTime: "10:30",
    endTime: "11:45",
    title: "Pre-Game Warmup & Routine @ Suffern",
    location: "Suffern Middle School",
    plan: [
      {
        time: 15,
        category: "⚡ (Warm-up, Agility and Conditioning)",
        format: "static",
        stations: [
          {
            name: "Full Team Dynamic Warmup & Activation",
            desc: "Dynamic stretching, knee tucks, high knees, butt kicks, 10-yard build-up sprints",
            coach: "",
            focus: "Game readiness, muscle activation & joint mobility"
          }
        ]
      },
      {
        time: 15,
        category: "🏈 Offense",
        format: "rotating",
        stations: [
          {
            name: "QB / WR Passing Tree & Routes vs Air",
            desc: "Snaps, quick game, intermediate routes, timing & sidelines",
            coach: "",
            focus: "Throw on time, crisp cuts & secure catches"
          },
          {
            name: "OL / RB Run Fit & Mesh Warmup",
            desc: "Inside zone, dive mesh, gap footwork and first-step punch",
            coach: "",
            focus: "Clean handoffs & first step explosion"
          }
        ]
      },
      {
        time: 15,
        category: "🛡️ Defense",
        format: "rotating",
        stations: [
          {
            name: "DL Get-Off & Punch Shuck",
            desc: "Reaction to ball snap, violent punch, lockout and shed",
            coach: "",
            focus: "Fast twitch get-off, no offsides"
          },
          {
            name: "DB / LB Pursuit & Breakdown Angles",
            desc: "Angle of pursuit, breakdown, shuffle, tag off hip",
            coach: "",
            focus: "Proper angle to outside hip, leverage"
          }
        ]
      },
      {
        time: 15,
        category: "📋 General",
        format: "static",
        stations: [
          {
            name: "Special Teams & Opening Script Review",
            desc: "Kickoff, Kick Return, Punt alignment, call & walk through first 5 scripted plays",
            coach: "",
            focus: "Personnel groups, zero pre-snap penalties, game focus"
          }
        ]
      }
    ],
    periods: [
      {
        time: 15,
        category: "⚡ (Warm-up, Agility and Conditioning)",
        format: "static",
        stations: [
          {
            name: "Full Team Dynamic Warmup & Activation",
            desc: "Dynamic stretching, knee tucks, high knees, butt kicks, 10-yard build-up sprints",
            coach: "",
            focus: "Game readiness, muscle activation & joint mobility"
          }
        ]
      },
      {
        time: 15,
        category: "🏈 Offense",
        format: "rotating",
        stations: [
          {
            name: "QB / WR Passing Tree & Routes vs Air",
            desc: "Snaps, quick game, intermediate routes, timing & sidelines",
            coach: "",
            focus: "Throw on time, crisp cuts & secure catches"
          },
          {
            name: "OL / RB Run Fit & Mesh Warmup",
            desc: "Inside zone, dive mesh, gap footwork and first-step punch",
            coach: "",
            focus: "Clean handoffs & first step explosion"
          }
        ]
      },
      {
        time: 15,
        category: "🛡️ Defense",
        format: "rotating",
        stations: [
          {
            name: "DL Get-Off & Punch Shuck",
            desc: "Reaction to ball snap, violent punch, lockout and shed",
            coach: "",
            focus: "Fast twitch get-off, no offsides"
          },
          {
            name: "DB / LB Pursuit & Breakdown Angles",
            desc: "Angle of pursuit, breakdown, shuffle, tag off hip",
            coach: "",
            focus: "Proper angle to outside hip, leverage"
          }
        ]
      },
      {
        time: 15,
        category: "📋 General",
        format: "static",
        stations: [
          {
            name: "Special Teams & Opening Script Review",
            desc: "Kickoff, Kick Return, Punt alignment, call & walk through first 5 scripted plays",
            coach: "",
            focus: "Personnel groups, zero pre-snap penalties, game focus"
          }
        ]
      }
    ]
  },
  {
    id: "p_w2_1",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 2",
    dayFolder: "Tuesday 9/08",
    date: "2026-09-08",
    title: "Week 2 - Somers Wing-T Contain & Tackling",
    location: "Crane Road",
    periods: [
      {
        time: 15,
        category: "📋 General",
        format: "static",
        stations: [
          {
            name: "Chalk Talk & Defensive Scouting",
            desc: "Review opponent 5-3 defense and blitz tendencies.",
            coach: "",
            focus: "Blocking assignments"
          }
        ]
      },
      {
        time: 30,
        category: "🏈 Offense",
        format: "rotating",
        stations: [
          {
            name: "Counter 21 Reverse & Bootleg Pass Install",
            desc: "Misdirection footwork, tight end drag route.",
            coach: "",
            focus: "Sell the fake run"
          },
          {
            name: "OL Trap Block Technique",
            desc: "Backside guard pull, trap 3-tech defensive tackle.",
            coach: "",
            focus: "Tight pull line, head in hole"
          }
        ]
      },
      {
        time: 30,
        category: "🛡️ Defense",
        format: "rotating",
        stations: [
          {
            name: "Defending the Wing-T / Sweep",
            desc: "Force outside run back inside, linebackers scrape downhill.",
            coach: "",
            focus: "Set edge firmly"
          }
        ]
      },
      {
        time: 15,
        category: "🎯 Special Teams",
        format: "static",
        stations: [
          {
            name: "Punt & Punt Protection Team",
            desc: "Shield punt wall, long snap consistency, 40-yard sprint gunners.",
            coach: "",
            focus: "Zero blocked punts, fair catch awareness"
          }
        ]
      }
    ]
  },
  {
    id: "p_w2_2",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 2",
    dayFolder: "Thursday 9/10",
    date: "2026-09-10",
    title: "Week 2 - Redzone Execution & 2-Pt Plays",
    location: "Crane Road",
    periods: [
      {
        time: 15,
        category: "⚡ (Warm-up, Agility and Conditioning)",
        format: "static",
        stations: [
          {
            name: "Dynamic Warmup & Agility",
            desc: "Ladder drills and hip mobility.",
            coach: "",
            focus: "Agility and foot quickness"
          }
        ]
      },
      {
        time: 30,
        category: "🏈 Offense",
        format: "static",
        stations: [
          {
            name: "Redzone & 2-Point Conversion Package",
            desc: "Goal line execution: Power 36, TE Pop, Wedge.",
            coach: "",
            focus: "Score from 3 yards out"
          }
        ]
      },
      {
        time: 30,
        category: "🛡️ Defense",
        format: "static",
        stations: [
          {
            name: "Goal Line Defense & Blitz Check",
            desc: "Gap fills and stopping interior push.",
            coach: "",
            focus: "No gain at the goal line"
          }
        ]
      },
      {
        time: 15,
        category: "🎯 Special Teams",
        format: "static",
        stations: [
          {
            name: "Extra Point & Field Goal Team",
            desc: "Snap, hold, kick timing in 1.3 seconds.",
            coach: "",
            focus: "Accuracy and snap consistency"
          }
        ]
      }
    ]
  },
  {
    id: "p_w3_1",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 3",
    dayFolder: "Tuesday 9/15",
    date: "2026-09-15",
    title: "Week 3 - Yorktown Spread Defense & Option",
    location: "Crane Road",
    periods: [
      {
        time: 15,
        category: "⚡ (Warm-up, Agility and Conditioning)",
        format: "static",
        stations: [
          {
            name: "Team Dynamic Warm-Up & Footwork",
            desc: "Cone drills, 5-10-5 shuttle, rapid hip turn.",
            coach: "",
            focus: "Change of direction and pad level"
          }
        ]
      },
      {
        time: 25,
        category: "🏈 Offense",
        format: "rotating",
        stations: [
          {
            name: "Option & Pitch Timing (Sweep 29)",
            desc: "QB mesh with fullback, pitch to tailback on perimeter.",
            coach: "",
            focus: "Pitch on outside shoulder"
          },
          {
            name: "OL Reach & Seal on Yorktown 4-4",
            desc: "Reach block defensive end, climb to inside linebacker.",
            coach: "",
            focus: "Wide base and sustained hand punch"
          }
        ]
      },
      {
        time: 25,
        category: "🛡️ Defense",
        format: "rotating",
        stations: [
          {
            name: "Contain & Option Assignment",
            desc: "DE takes QB dive, OLB takes pitch, CB forces inside.",
            coach: "",
            focus: "Discipline on option reads"
          },
          {
            name: "Pass Coverage & Deep Thirds",
            desc: "Cover-3 zone drop, rally to flats on throw.",
            coach: "",
            focus: "Backpedal speed and break on ball"
          }
        ]
      },
      {
        time: 25,
        category: "⚔️ Practice / Scrimmage",
        format: "static",
        stations: [
          {
            name: "11-on-11 Situational Scrimmage vs Spread",
            desc: "Offense script vs Defense scout team, 3rd & long conversions.",
            coach: "",
            focus: "Game tempo and quick huddle breaks"
          }
        ]
      }
    ]
  },
  {
    id: "p_w4_1",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 4",
    dayFolder: "Tuesday 9/22",
    date: "2026-09-22",
    title: "Week 4 - Brewster Power Run Defense & Counter",
    location: "Crane Road",
    periods: [
      {
        time: 15,
        category: "⚡ (Warm-up, Agility and Conditioning)",
        format: "static",
        stations: [
          {
            name: "Agility Ladder & Form Tackling",
            desc: "Speed ladder into near-foot form wrap on tackle wheel.",
            coach: "",
            focus: "Clean wrap and leg drive"
          }
        ]
      },
      {
        time: 30,
        category: "🏈 Offense",
        format: "rotating",
        stations: [
          {
            name: "Counter 21 Reverse & Bootleg Pass",
            desc: "Fake dive, guard pull, bootleg throw to tight end.",
            coach: "",
            focus: "Sell the fake run completely"
          },
          {
            name: "OL Guard Pull & Trap Footwork",
            desc: "Open step, scrape the center's hip, trap defensive tackle.",
            coach: "",
            focus: "Pad level and explosive shoulder contact"
          }
        ]
      },
      {
        time: 30,
        category: "🛡️ Defense",
        format: "rotating",
        stations: [
          {
            name: "Stopping Brewster Power I & Iso",
            desc: "LB fill A & B gaps, meet fullback in hole at line of scrimmage.",
            coach: "",
            focus: "No yards after contact"
          }
        ]
      },
      {
        time: 15,
        category: "🎯 Special Teams",
        format: "static",
        stations: [
          {
            name: "Punt Team & Fake Punt Package",
            desc: "Punt formation, gunner releases, fake punt pass option.",
            coach: "",
            focus: "100% protection execution"
          }
        ]
      }
    ]
  },
  {
    id: "p_w4_2",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 4",
    dayFolder: "Thursday 9/24",
    date: "2026-09-24",
    title: "Week 4 - Homecoming Redzone & Special Teams",
    location: "Crane Road",
    periods: [
      {
        time: 15,
        category: "📋 General",
        format: "static",
        stations: [
          {
            name: "Pregame Warm-Up Progression",
            desc: "Full pre-game routine, calisthenics, specialist kicks.",
            coach: "",
            focus: "High energy, Homecoming focus"
          }
        ]
      },
      {
        time: 30,
        category: "🏈 Offense",
        format: "static",
        stations: [
          {
            name: "Goal Line Heavy & Redzone Script",
            desc: "Heavy I-Formation, Wedge, Power 36, TE Pop pass.",
            coach: "",
            focus: "Touchdowns inside the 10 yard line"
          }
        ]
      },
      {
        time: 30,
        category: "🛡️ Defense",
        format: "static",
        stations: [
          {
            name: "Goal Line Stand & Blitz Exits",
            desc: "6-2 goal line front, zero pass coverage, A-gap blitz.",
            coach: "",
            focus: "Penetration and force fumble"
          }
        ]
      },
      {
        time: 15,
        category: "⚔️ Practice / Scrimmage",
        format: "static",
        stations: [
          {
            name: "Live Redzone 4-Play Series",
            desc: "Offense vs Defense 1st & goal from the 5-yard line.",
            coach: "",
            focus: "Game speed competitive finish"
          }
        ]
      }
    ]
  },
  {
    id: "p_w5_1",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 5",
    dayFolder: "Tuesday 9/29",
    date: "2026-09-29",
    title: "Week 5 - John Jay 5-3 Defense & Trap Blocking",
    location: "Crane Road",
    periods: [
      {
        time: 15,
        category: "⚡ (Warm-up, Agility and Conditioning)",
        format: "static",
        stations: [
          {
            name: "Dynamic Warm-Up & Pursuit Angles",
            desc: "Lateral shuffles and angled sprint pursuit.",
            coach: "",
            focus: "Speed and body control"
          }
        ]
      },
      {
        time: 30,
        category: "🏈 Offense",
        format: "rotating",
        stations: [
          {
            name: "25 Trap & Inside Zone vs 5-3 Front",
            desc: "Trap nose guard, seal middle linebacker with center.",
            coach: "",
            focus: "Timing and quick burst through hole"
          },
          {
            name: "OL Zone Combination Blocks",
            desc: "Guard & Tackle double-team down lineman to backside LB.",
            coach: "",
            focus: "Maintain hip-to-hip contact"
          }
        ]
      },
      {
        time: 30,
        category: "🛡️ Defense",
        format: "rotating",
        stations: [
          {
            name: "DL Nose & Tackle Sheds vs Double Teams",
            desc: "Split double team, fight pressure with pressure.",
            coach: "",
            focus: "Hold the line of scrimmage"
          }
        ]
      },
      {
        time: 15,
        category: "🎯 Special Teams",
        format: "static",
        stations: [
          {
            name: "Kick Return Wedge & Return Left/Right",
            desc: "Front line drop, form 3-man wedge, RB burst.",
            coach: "",
            focus: "Set up return wall cleanly"
          }
        ]
      }
    ]
  },
  {
    id: "p_w5_2",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 5",
    dayFolder: "Thursday 10/01",
    date: "2026-10-01",
    title: "Week 5 - Goal Line Stand & Pass Rush",
    location: "Crane Road",
    periods: [
      {
        time: 15,
        category: "📋 General",
        format: "static",
        stations: [
          {
            name: "Chalk Talk & John Jay Scouting Review",
            desc: "Defensive signals, cadence calls, wristband check.",
            coach: "",
            focus: "Mental preparation"
          }
        ]
      },
      {
        time: 30,
        category: "🏈 Offense",
        format: "static",
        stations: [
          {
            name: "11-on-Air Offensive Script Installation",
            desc: "Run first 15 offensive plays with game day wristbands.",
            coach: "",
            focus: "Zero alignment errors"
          }
        ]
      },
      {
        time: 30,
        category: "🛡️ Defense",
        format: "static",
        stations: [
          {
            name: "Pass Rush & Secondary Interception Drill",
            desc: "DE speed rush, DB high-point catch on football.",
            coach: "",
            focus: "Create turnovers"
          }
        ]
      },
      {
        time: 15,
        category: "🎯 Special Teams",
        format: "static",
        stations: [
          {
            name: "Field Goal & Extra Point Live Reps",
            desc: "10 live field goal reps from left/right hash.",
            coach: "",
            focus: "Snap-hold-kick rhythm in under 1.4 seconds"
          }
        ]
      }
    ]
  },
  {
    id: "p_w6_1",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 6",
    dayFolder: "Tuesday 10/06",
    date: "2026-10-06",
    title: "Week 6 - Lakeland Blitz Pickup & Screen Pass",
    location: "Crane Road",
    periods: [
      {
        time: 15,
        category: "⚡ (Warm-up, Agility and Conditioning)",
        format: "static",
        stations: [
          {
            name: "Warm-Up & Agility Shuttle",
            desc: "Dynamic warmup, ladder agility, fast footwork.",
            coach: "",
            focus: "Speed and pad level"
          }
        ]
      },
      {
        time: 30,
        category: "🏈 Offense",
        format: "rotating",
        stations: [
          {
            name: "RB Screen Pass & Quick Slants",
            desc: "Let defensive line rush, dump pass behind line, OL lead wall.",
            coach: "",
            focus: "Patience and timing on screen"
          },
          {
            name: "Blitz Pickup & Pass Protection",
            desc: "FB and RB identify blitzing linebackers and step up in A/B gap.",
            coach: "",
            focus: "Eyes on linebacker, maintain pocket"
          }
        ]
      },
      {
        time: 30,
        category: "🛡️ Defense",
        format: "rotating",
        stations: [
          {
            name: "Corner Blitz & Fire Zone Coverage",
            desc: "CB off the edge, safety rotates over top, DL slant away.",
            coach: "",
            focus: "Disguise pre-snap, explode on snap"
          }
        ]
      },
      {
        time: 15,
        category: "🎯 Special Teams",
        format: "static",
        stations: [
          {
            name: "Punt Coverage & Fair Catch Enforcement",
            desc: "Gunners sprint to returner, call fair catch signal.",
            coach: "",
            focus: "Down the ball inside the 10 yard line"
          }
        ]
      }
    ]
  },
  {
    id: "p_w6_2",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 6",
    dayFolder: "Thursday 10/08",
    date: "2026-10-08",
    title: "Week 6 - Senior Night Scrimmage & 2-Minute",
    location: "Crane Road",
    periods: [
      {
        time: 15,
        category: "📋 General",
        format: "static",
        stations: [
          {
            name: "Senior Night Preparation & Chalk Talk",
            desc: "Review Lakeland defense, player leadership recognition.",
            coach: "",
            focus: "Focus and pride"
          }
        ]
      },
      {
        time: 30,
        category: "🏈 Offense",
        format: "static",
        stations: [
          {
            name: "Redzone & Trick Play Installation",
            desc: "Halfback pass, reverse pass, hook and lateral.",
            coach: "",
            focus: "Ball security on trick plays"
          }
        ]
      },
      {
        time: 30,
        category: "🛡️ Defense",
        format: "static",
        stations: [
          {
            name: "Redzone Goal Line Defense & Turnover Circuit",
            desc: "Strip the football, scoop and score, goal line stands.",
            coach: "",
            focus: "Turnovers win championships"
          }
        ]
      },
      {
        time: 15,
        category: "⚔️ Practice / Scrimmage",
        format: "static",
        stations: [
          {
            name: "Controlled 11-on-11 Scrimmage",
            desc: "15 plays game tempo with game uniforms check.",
            coach: "",
            focus: "High tempo and zero penalties"
          }
        ]
      }
    ]
  },
  {
    id: "p_w7_1",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 7",
    dayFolder: "Tuesday 10/13",
    date: "2026-10-13",
    title: "Week 7 - Arlington Contain & Form Tackling",
    location: "Crane Road",
    periods: [
      {
        time: 15,
        category: "⚡ (Warm-up, Agility and Conditioning)",
        format: "static",
        stations: [
          {
            name: "Dynamic Warm-Up & Footwork",
            desc: "Speed ladder, high knees, agility bags.",
            coach: "",
            focus: "Speed and agility"
          }
        ]
      },
      {
        time: 30,
        category: "🏈 Offense",
        format: "rotating",
        stations: [
          {
            name: "Power 36 Iso & 24 Dive Execution",
            desc: "FB lead through 6 hole, RB follow hip and accelerate.",
            coach: "",
            focus: "North-south running style"
          },
          {
            name: "OL Drive Block & Stance Alignment",
            desc: "Pound the sled, strike on rising plane, leg drive.",
            coach: "",
            focus: "Move the defensive line off the ball"
          }
        ]
      },
      {
        time: 30,
        category: "🛡️ Defense",
        format: "rotating",
        stations: [
          {
            name: "Arlington Outside Sweep Contain",
            desc: "Force everything back inside to pursuing linebackers.",
            coach: "",
            focus: "Do not let ball carrier get outside numbers"
          }
        ]
      },
      {
        time: 15,
        category: "💥 Tackling",
        format: "static",
        stations: [
          {
            name: "Open Field Form Tackling Circuit",
            desc: "Eyes on belt buckle, wrap and drive through contact.",
            coach: "",
            focus: "Head safe form tackling"
          }
        ]
      }
    ]
  },
  {
    id: "p_w7_2",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 7",
    dayFolder: "Thursday 10/15",
    date: "2026-10-15",
    title: "Week 7 - Season Finale Polish & Redzone Execution",
    location: "Crane Road",
    periods: [
      {
        time: 15,
        category: "📋 General",
        format: "static",
        stations: [
          {
            name: "Chalk Talk & Season Finale Game Plan",
            desc: "Review Arlington tendencies, special teams assignments.",
            coach: "",
            focus: "Sharp focus"
          }
        ]
      },
      {
        time: 30,
        category: "🏈 Offense",
        format: "static",
        stations: [
          {
            name: "Full Offensive Script on Air",
            desc: "20 plays on air with fast tempo and pristine execution.",
            coach: "",
            focus: "Sharp route cuts and timing"
          }
        ]
      },
      {
        time: 30,
        category: "🛡️ Defense",
        format: "static",
        stations: [
          {
            name: "Defensive Alignment & Scramble Drill",
            desc: "Cover receivers on QB scramble, rally to ball.",
            coach: "",
            focus: "Never give up on the play"
          }
        ]
      },
      {
        time: 15,
        category: "🎯 Special Teams",
        format: "static",
        stations: [
          {
            name: "Special Teams Final Check",
            desc: "Kickoff, Kick Return, Punt, FG, Onside Defense.",
            coach: "",
            focus: "100% assignment execution"
          }
        ]
      }
    ]
  },
  {
    id: "p_w8_1",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 8",
    dayFolder: "Tuesday 10/20",
    date: "2026-10-20",
    title: "Playoffs Round 1 - Situational & Special Teams",
    location: "Crane Road",
    periods: [
      {
        time: 15,
        category: "⚡ (Warm-up, Agility and Conditioning)",
        format: "static",
        stations: [
          {
            name: "Playoff Dynamic Warm-Up & High Intensity Sprints",
            desc: "Playoff tempo, agility ladders, and lateral shuffles.",
            coach: "",
            focus: "Playoff intensity from whistle to whistle"
          }
        ]
      },
      {
        time: 30,
        category: "🏈 Offense",
        format: "rotating",
        stations: [
          {
            name: "Playoff Core Plays & 3rd Down Conversions",
            desc: "24 Dive, Sweep 28, Counter 21 on 3rd & short / 3rd & medium.",
            coach: "",
            focus: "Move the chains"
          },
          {
            name: "OL Goal Line Drive Blocks",
            desc: "6-inch power step, tight splits, push the pile.",
            coach: "",
            focus: "Score from 1 yard out"
          }
        ]
      },
      {
        time: 30,
        category: "🛡️ Defense",
        format: "rotating",
        stations: [
          {
            name: "Playoff Turnover Circuit & Tackle Leverage",
            desc: "Strip ball, scoop and score, 2-man gang tackling.",
            coach: "",
            focus: "Turnovers decide playoff games"
          }
        ]
      },
      {
        time: 15,
        category: "🎯 Special Teams",
        format: "static",
        stations: [
          {
            name: "Punt & Field Goal Mastery",
            desc: "Punt execution, no blocks, reliable extra points.",
            coach: "",
            focus: "Flawless special teams execution"
          }
        ]
      }
    ]
  },
  {
    id: "p_w8_2",
    teamId: "team_10u",
    year: "2026",
    weekFolder: "Week 8",
    dayFolder: "Thursday 10/22",
    date: "2026-10-22",
    title: "Playoffs Round 1 - Full Script Dress Rehearsal",
    location: "Crane Road",
    periods: [
      {
        time: 15,
        category: "📋 General",
        format: "static",
        stations: [
          {
            name: "Chalk Talk & Playoff Game Plan Review",
            desc: "Playoff keys to victory, mental focus, assignments.",
            coach: "",
            focus: "Execute under pressure"
          }
        ]
      },
      {
        time: 30,
        category: "🏈 Offense",
        format: "static",
        stations: [
          {
            name: "Playoff 11-on-11 Scrimmage Script",
            desc: "Offense vs Defense 20-play live dress rehearsal.",
            coach: "",
            focus: "Zero turnovers, high tempo execution"
          }
        ]
      },
      {
        time: 30,
        category: "🛡️ Defense",
        format: "static",
        stations: [
          {
            name: "Goal Line & 2-Minute Playoff Defense",
            desc: "Prevent big plays, secure redzone stop, celebrate team stops.",
            coach: "",
            focus: "Pitch a shutout"
          }
        ]
      },
      {
        time: 15,
        category: "📋 General",
        format: "static",
        stations: [
          {
            name: "Team Huddle & Championship Focus",
            desc: "Team cheer, final wristband inspection, game day reminder.",
            coach: "",
            focus: "Mahopac Pride & Brotherhood"
          }
        ]
      }
    ]
  }
];



