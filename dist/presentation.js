var e,t,s,i,r,a,n,o,l,c,h,d,u,p,m,g,f,$,v,y,b,P,R,I={31:function(e,t,s){var i;!function(e,r){function a(e){var t=this,s="";t.next=function(){var e=t.x^t.x>>>2;return t.x=t.y,t.y=t.z,t.z=t.w,t.w=t.v,(t.d=t.d+362437|0)+(t.v=t.v^t.v<<4^e^e<<1)|0},t.x=0,t.y=0,t.z=0,t.w=0,t.v=0,e===(0|e)?t.x=e:s+=e;for(var i=0;i<s.length+64;i++)t.x^=0|s.charCodeAt(i),i==s.length&&(t.d=t.x<<10^t.x>>>4),t.next()}function n(e,t){return t.x=e.x,t.y=e.y,t.z=e.z,t.w=e.w,t.v=e.v,t.d=e.d,t}function o(e,t){var s=new a(e),i=t&&t.state,r=function(){return(s.next()>>>0)/4294967296};return r.double=function(){do{var e=((s.next()>>>11)+(s.next()>>>0)/4294967296)/(1<<21)}while(0===e);return e},r.int32=s.next,r.quick=r,i&&("object"==typeof i&&n(i,s),r.state=function(){return n(s,{})}),r}r&&r.exports?r.exports=o:s.amdD&&s.amdO?void 0===(i=function(){return o}.call(t,s,t,r))||(r.exports=i):this.xorwow=o}(0,e=s.nmd(e),s.amdD)},67:function(e,t,s){var i;!function(e,r){function a(e){var t=this;t.next=function(){var e,s,i=t.x,r=t.i;return e=i[r],s=(e^=e>>>7)^e<<24,s^=(e=i[r+1&7])^e>>>10,s^=(e=i[r+3&7])^e>>>3,s^=(e=i[r+4&7])^e<<7,e=i[r+7&7],s^=(e^=e<<13)^e<<9,i[r]=s,t.i=r+1&7,s},function(e,t){var s,i=[];if(t===(0|t))i[0]=t;else for(t=""+t,s=0;s<t.length;++s)i[7&s]=i[7&s]<<15^t.charCodeAt(s)+i[s+1&7]<<13;for(;i.length<8;)i.push(0);for(s=0;s<8&&0===i[s];++s);for(8==s?i[7]=-1:i[s],e.x=i,e.i=0,s=256;s>0;--s)e.next()}(t,e)}function n(e,t){return t.x=e.x.slice(),t.i=e.i,t}function o(e,t){null==e&&(e=+new Date);var s=new a(e),i=t&&t.state,r=function(){return(s.next()>>>0)/4294967296};return r.double=function(){do{var e=((s.next()>>>11)+(s.next()>>>0)/4294967296)/(1<<21)}while(0===e);return e},r.int32=s.next,r.quick=r,i&&(i.x&&n(i,s),r.state=function(){return n(s,{})}),r}r&&r.exports?r.exports=o:s.amdD&&s.amdO?void 0===(i=function(){return o}.call(t,s,t,r))||(r.exports=i):this.xorshift7=o}(0,e=s.nmd(e),s.amdD)},180:function(e,t,s){var i;!function(e,r){function a(e){var t,s=this,i=(t=4022871197,function(e){e=String(e);for(var s=0;s<e.length;s++){var i=.02519603282416938*(t+=e.charCodeAt(s));i-=t=i>>>0,t=(i*=t)>>>0,t+=4294967296*(i-=t)}return 2.3283064365386963e-10*(t>>>0)});s.next=function(){var e=2091639*s.s0+2.3283064365386963e-10*s.c;return s.s0=s.s1,s.s1=s.s2,s.s2=e-(s.c=0|e)},s.c=1,s.s0=i(" "),s.s1=i(" "),s.s2=i(" "),s.s0-=i(e),s.s0<0&&(s.s0+=1),s.s1-=i(e),s.s1<0&&(s.s1+=1),s.s2-=i(e),s.s2<0&&(s.s2+=1),i=null}function n(e,t){return t.c=e.c,t.s0=e.s0,t.s1=e.s1,t.s2=e.s2,t}function o(e,t){var s=new a(e),i=t&&t.state,r=s.next;return r.int32=function(){return 4294967296*s.next()|0},r.double=function(){return r()+11102230246251565e-32*(2097152*r()|0)},r.quick=r,i&&("object"==typeof i&&n(i,s),r.state=function(){return n(s,{})}),r}r&&r.exports?r.exports=o:s.amdD&&s.amdO?void 0===(i=function(){return o}.call(t,s,t,r))||(r.exports=i):this.alea=o}(0,e=s.nmd(e),s.amdD)},181:function(e,t,s){var i;!function(e,r){function a(e){var t=this,s="";t.x=0,t.y=0,t.z=0,t.w=0,t.next=function(){var e=t.x^t.x<<11;return t.x=t.y,t.y=t.z,t.z=t.w,t.w^=t.w>>>19^e^e>>>8},e===(0|e)?t.x=e:s+=e;for(var i=0;i<s.length+64;i++)t.x^=0|s.charCodeAt(i),t.next()}function n(e,t){return t.x=e.x,t.y=e.y,t.z=e.z,t.w=e.w,t}function o(e,t){var s=new a(e),i=t&&t.state,r=function(){return(s.next()>>>0)/4294967296};return r.double=function(){do{var e=((s.next()>>>11)+(s.next()>>>0)/4294967296)/(1<<21)}while(0===e);return e},r.int32=s.next,r.quick=r,i&&("object"==typeof i&&n(i,s),r.state=function(){return n(s,{})}),r}r&&r.exports?r.exports=o:s.amdD&&s.amdO?void 0===(i=function(){return o}.call(t,s,t,r))||(r.exports=i):this.xor128=o}(0,e=s.nmd(e),s.amdD)},234:()=>{},391:(e,t,s)=>{var i=s(180),r=s(181),a=s(31),n=s(67),o=s(833),l=s(717),c=s(801);c.alea=i,c.xor128=r,c.xorwow=a,c.xorshift7=n,c.xor4096=o,c.tychei=l,e.exports=c},717:function(e,t,s){var i;!function(e,r){function a(e){var t=this,s="";t.next=function(){var e=t.b,s=t.c,i=t.d,r=t.a;return e=e<<25^e>>>7^s,s=s-i|0,i=i<<24^i>>>8^r,r=r-e|0,t.b=e=e<<20^e>>>12^s,t.c=s=s-i|0,t.d=i<<16^s>>>16^r,t.a=r-e|0},t.a=0,t.b=0,t.c=-1640531527,t.d=1367130551,e===Math.floor(e)?(t.a=e/4294967296|0,t.b=0|e):s+=e;for(var i=0;i<s.length+20;i++)t.b^=0|s.charCodeAt(i),t.next()}function n(e,t){return t.a=e.a,t.b=e.b,t.c=e.c,t.d=e.d,t}function o(e,t){var s=new a(e),i=t&&t.state,r=function(){return(s.next()>>>0)/4294967296};return r.double=function(){do{var e=((s.next()>>>11)+(s.next()>>>0)/4294967296)/(1<<21)}while(0===e);return e},r.int32=s.next,r.quick=r,i&&("object"==typeof i&&n(i,s),r.state=function(){return n(s,{})}),r}r&&r.exports?r.exports=o:s.amdD&&s.amdO?void 0===(i=function(){return o}.call(t,s,t,r))||(r.exports=i):this.tychei=o}(0,e=s.nmd(e),s.amdD)},801:function(e,t,s){var i;!function(r,a,n){var o,l=256,c=n.pow(l,6),h=n.pow(2,52),d=2*h,u=255;function p(e,t,s){var i=[],u=$(f((t=1==t?{entropy:!0}:t||{}).entropy?[e,v(a)]:null==e?function(){try{var e;return o&&(e=o.randomBytes)?e=e(l):(e=new Uint8Array(l),(r.crypto||r.msCrypto).getRandomValues(e)),v(e)}catch(e){var t=r.navigator,s=t&&t.plugins;return[+new Date,r,s,r.screen,v(a)]}}():e,3),i),p=new m(i),y=function(){for(var e=p.g(6),t=c,s=0;e<h;)e=(e+s)*l,t*=l,s=p.g(1);for(;e>=d;)e/=2,t/=2,s>>>=1;return(e+s)/t};return y.int32=function(){return 0|p.g(4)},y.quick=function(){return p.g(4)/4294967296},y.double=y,$(v(p.S),a),(t.pass||s||function(e,t,s,i){return i&&(i.S&&g(i,p),e.state=function(){return g(p,{})}),s?(n.random=e,t):e})(y,u,"global"in t?t.global:this==n,t.state)}function m(e){var t,s=e.length,i=this,r=0,a=i.i=i.j=0,n=i.S=[];for(s||(e=[s++]);r<l;)n[r]=r++;for(r=0;r<l;r++)n[r]=n[a=u&a+e[r%s]+(t=n[r])],n[a]=t;(i.g=function(e){for(var t,s=0,r=i.i,a=i.j,n=i.S;e--;)t=n[r=u&r+1],s=s*l+n[u&(n[r]=n[a=u&a+t])+(n[a]=t)];return i.i=r,i.j=a,s})(l)}function g(e,t){return t.i=e.i,t.j=e.j,t.S=e.S.slice(),t}function f(e,t){var s,i=[],r=typeof e;if(t&&"object"==r)for(s in e)try{i.push(f(e[s],t-1))}catch(e){}return i.length?i:"string"==r?e:e+"\0"}function $(e,t){for(var s,i=e+"",r=0;r<i.length;)t[u&r]=u&(s^=19*t[u&r])+i.charCodeAt(r++);return v(t)}function v(e){return String.fromCharCode.apply(0,e)}if($(n.random(),a),e.exports){e.exports=p;try{o=s(234)}catch(e){}}else void 0===(i=function(){return p}.call(t,s,t,e))||(e.exports=i)}("undefined"!=typeof self?self:this,[],Math)},833:function(e,t,s){var i;!function(e,r){function a(e){var t=this;t.next=function(){var e,s,i=t.w,r=t.X,a=t.i;return t.w=i=i+1640531527|0,s=r[a+34&127],e=r[a=a+1&127],s^=s<<13,e^=e<<17,s^=s>>>15,e^=e>>>12,s=r[a]=s^e,t.i=a,s+(i^i>>>16)|0},function(e,t){var s,i,r,a,n,o=[],l=128;for(t===(0|t)?(i=t,t=null):(t+="\0",i=0,l=Math.max(l,t.length)),r=0,a=-32;a<l;++a)t&&(i^=t.charCodeAt((a+32)%t.length)),0===a&&(n=i),i^=i<<10,i^=i>>>15,i^=i<<4,i^=i>>>13,a>=0&&(n=n+1640531527|0,r=0==(s=o[127&a]^=i+n)?r+1:0);for(r>=128&&(o[127&(t&&t.length||0)]=-1),r=127,a=512;a>0;--a)i=o[r+34&127],s=o[r=r+1&127],i^=i<<13,s^=s<<17,i^=i>>>15,s^=s>>>12,o[r]=i^s;e.w=n,e.X=o,e.i=r}(t,e)}function n(e,t){return t.i=e.i,t.w=e.w,t.X=e.X.slice(),t}function o(e,t){null==e&&(e=+new Date);var s=new a(e),i=t&&t.state,r=function(){return(s.next()>>>0)/4294967296};return r.double=function(){do{var e=((s.next()>>>11)+(s.next()>>>0)/4294967296)/(1<<21)}while(0===e);return e},r.int32=s.next,r.quick=r,i&&(i.X&&n(i,s),r.state=function(){return n(s,{})}),r}r&&r.exports?r.exports=o:s.amdD&&s.amdO?void 0===(i=function(){return o}.call(t,s,t,r))||(r.exports=i):this.xor4096=o}(0,e=s.nmd(e),s.amdD)}},T={};function S(e){var t=T[e];if(void 0!==t)return t.exports;var s=T[e]={id:e,loaded:!1,exports:{}};return I[e].call(s.exports,s,s.exports,S),s.loaded=!0,s.exports}S.amdD=function(){throw new Error("define cannot be used indirect")},S.amdO={},S.n=e=>{var t=e&&e.__esModule?()=>e.default:()=>e;return S.d(t,{a:t}),t},S.d=(e,t)=>{for(var s in t)S.o(t,s)&&!S.o(e,s)&&Object.defineProperty(e,s,{enumerable:!0,get:t[s]})},S.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),S.nmd=e=>(e.paths=[],e.children||(e.children=[]),e),function(e){e.ERROR="ERROR",e.STRIKEOUT="STRIKEOUT",e.OUT="OUT",e.HIT_BY_PITCH="HIT_BY_PITCH",e.BB="BB",e.SINGLE="SINGLE",e.DOUBLE="DOUBLE",e.TRIPLE="TRIPLE",e.HR="HR"}(e||(e={})),function(e){e.GROUNDBALL="GROUNDBALL",e.LINE_DRIVE="LINE_DRIVE",e.FLY_BALL="FLY_BALL"}(t||(t={})),function(e){e.SHALLOW="SHALLOW",e.NORMAL="NORMAL",e.DEEP="DEEP"}(s||(s={})),function(e){e.LOW_AWAY="LOW_AWAY",e.LOW_MIDDLE="LOW_MIDDLE",e.LOW_INSIDE="LOW_INSIDE",e.MID_AWAY="MID_AWAY",e.MID_MIDDLE="MID_MIDDLE",e.MID_INSIDE="MID_INSIDE",e.HIGH_AWAY="HIGH_AWAY",e.HIGH_MIDDLE="HIGH_MIDDLE",e.HIGH_INSIDE="HIGH_INSIDE"}(i||(i={})),function(e){e.BALL="BALL",e.STRIKE="STRIKE",e.FOUL="FOUL",e.IN_PLAY="IN_PLAY",e.HBP="HIT_BY_PITCH"}(r||(r={})),function(e){e.FF="FF",e.CU="CU",e.CH="CH",e.FC="FC",e.FO="FO",e.KN="KN",e.KC="KC",e.SC="SC",e.SI="SI",e.SL="SL",e.SV="SV",e.FS="FS",e.ST="ST"}(a||(a={})),function(e){e.FIRST="1B",e.SECOND="2B",e.THIRD="3B",e.HOME="home"}(n||(n={})),function(e){e.L="L",e.R="R",e.S="S"}(o||(o={})),function(e){e.CATCHER="C",e.PITCHER="P",e.FIRST_BASE="1B",e.SECOND_BASE="2B",e.THIRD_BASE="3B",e.SHORTSTOP="SS",e.LEFT_FIELD="LF",e.CENTER_FIELD="CF",e.RIGHT_FIELD="RF",e.DESIGNATED_HITTER="DH"}(l||(l={})),function(e){e.INTENT_WALK="Intent Walk",e.HIT_BY_PITCH="Hit By Pitch",e.SAC_FLY="Sac Fly",e.SAC_FLY_DP="Sac Fly DP",e.WALK="Walk",e.CATCHER_INTERFERENCE="Catcher Interference",e.RUNNER_OUT="Runner Out",e.EJECTION="Ejection",e.SINGLE="Single",e.DOUBLE="Double",e.TRIPLE="Triple",e.HOME_RUN="Home Run",e.STRIKEOUT="Strikeout",e.STRIKEOUT_DP="Strikeout - DP",e.SAC_BUNT="Sac Bunt",e.SAC_BUNT_DP="Sacrifice Bunt DP",e.BATTER_INTERFERENCE="Batter Interference",e.BUNT_GROUNDOUT="Bunt Groundout",e.BUNT_LINEOUT="Bunt Lineout",e.BUNT_POPOUT="Bunt Pop Out",e.FAN_INTERFERENCE="Fan Interference",e.FIELDERS_CHOICE="Fielders Choice",e.FLYOUT="Flyout",e.POP_OUT="Pop Out",e.FOURCEOUT="Forceout",e.GROUNDOUT="Groundout",e.GROUNDED_INTO_DP="Grounded Into DP",e.TRIPLE_PLAY="Triple Play",e.REACHED_ON_ERROR="Reached on Error"}(c||(c={})),function(e){e.TAGGED_OUT="Tagged out",e.FORCE_OUT="Force out",e.HOME_TO_FIRST="Advanced from home to 1B",e.HOME_TO_SECOND="Advanced from home to 2B",e.HOME_TO_THIRD="Advanced from home to 3B",e.HOME_TO_SCORE="Advanced from home to come around and score",e.FIRST_TO_SECOND="Advanced from 1B to 2B",e.FIRST_TO_THIRD="Advanced from 1B to 3B",e.FIRST_TO_HOME="Advanced from 1B to home",e.SECOND_TO_THIRD="Advanced from 2B to 3B",e.SECOND_TO_HOME="Advanced from 2B to home",e.THIRD_TO_HOME="Advanced from 3B to home",e.TAGGED_FIRST_TO_SECOND="Tagged up and moved from 1B to 2B",e.TAGGED_SECOND_TO_THIRD="Tagged up and moved from 2B to 3B",e.TAGGED_THIRD_TO_HOME="Tagged up and scored from 3B.",e.STOLEN_BASE_2B="Stolen Base 2B",e.STOLEN_BASE_3B="Stolen Base 3B",e.STOLEN_BASE_HOME="Stolen Base Home",e.CAUGHT_STEALING_2B="Caught Stealing 2B",e.CAUGHT_STEALING_3B="Caught Stealing 3B",e.CAUGHT_STEALING_HOME="Caught Stealing Home"}(h||(h={})),function(e){e.ASSIST="ASSIST",e.ERROR="ERROR",e.PUTOUT="PUTOUT",e.CAUGHT_STEALING="CAUGHT_STEALING",e.PASSED_BALL="PASSED_BALL"}(d||(d={})),function(e){e.SAFE="safe",e.OUT="out",e.NO_THROW="no throw"}(u||(u={})),function(e){e.FAIR="FAIR",e.FOUL="FOUL",e.STRIKE="STRIKE",e.NO_SWING="NO_SWING"}(p||(p={})),function(e){e.HOME="Home",e.AWAY="Away"}(m||(m={})),function(e){e.CONTACT="CONTACT",e.MISS="MISS"}(g||(g={})),function(e){e.STARTER="starter",e.CLOSER="closer",e.SETUP="setup",e.MIDDLE="middle",e.LONG="long",e.MOP_UP="mop_up"}(f||(f={})),function(e){e.SWING="swing",e.TAKE="take"}($||($={})),function(e){e.FAIR="FAIR",e.FOUL="FOUL"}(v||(v={})),function(e){e.OUT="OUT",e.SINGLE="SINGLE"}(y||(y={})),function(e){e.HIT="HIT",e.OUT="OUT"}(b||(b={}));class E{getPlayDescriptions(e,t){const s=[],i=this.getGamePlayers(e),a=i[t.hitterId];let n;s.push(...this.getSubstitutionDescriptions(e,t)),s.push({type:P.RECAP,text:this.getMatchupDescription(t,a)});const o=t.pitchLog?.pitches??[];for(let i=0;i<o.length;i++){const a=o[i];a.result===r.IN_PLAY&&(n=a),s.push({type:P.RECAP,text:this.getPitchDescription(a),meta:{pitch:a}});const l=t.runner?.events?.filter(e=>e.pitchIndex===i)??[];for(const i of l){if(this.isBatterRunnerPrimaryEvent(t,i))continue;const r=this.getRunnerDescription(e,i);r&&s.push({type:P.RECAP,text:r})}}const l=t.fielderId?i[t.fielderId]:void 0;s.push(...this.getPlayResultDescription(t,a,l,n)),s.push(...this.getRunnerRecapDescription(e,t));let c=!1;const h=t.runner?.result?.end?.scored?.length??0;if(h>0&&(s.push({type:P.RECAP,text:1===h?"1 run scores.":`${h} runs score.`}),s.push({type:P.RECAP,text:`The score is ${t.score.end?.away??t.score.start.away} - ${t.score.end?.home??t.score.start.home}.`}),c=!0),(t.runner?.result?.end?.out?.length??0)>0){const i=t.count.end?.outs??0;if(3===i)if(s.push({type:P.RECAP,text:"There's 3 outs and the inning is complete."}),this.isGameEndingPlay(e,t))s.push(...this.getGameRecapDescriptions(e,t));else{const e=t.inningTop?"top":"bottom",i=t.score.end?.away??t.score.start.away,r=t.score.end?.home??t.score.start.home,a=c?`End of the ${e} of the ${this.ordinal(t.inningNum)}. It's ${i} - ${r}.`:`We'll switch sides. The score is ${i} - ${r}.`;s.push({type:P.RECAP,text:a})}else s.push({type:P.RECAP,text:`There ${this.getOutsPhrase(i)}.`})}return s}getPlayByPlay(e){const t=[];for(const s of[...e.halfInnings??[]].reverse())for(const i of[...s.plays].reverse())t.push({descriptions:this.getPlayDescriptions(e,i),play:i});return t}getGameStartDescriptions(e){const t=this.getGamePlayers(e),s=e.away.currentPitcherId?t[e.away.currentPitcherId]:void 0,i=e.home.currentPitcherId?t[e.home.currentPitcherId]:void 0,r=this.getTeamName(e.away),a=this.getTeamName(e.home),n=[{type:P.RECAP,text:`${r} at ${a}.`}];return s&&n.push({type:P.RECAP,text:`${s.fullName} gets the start for ${r}.`}),i&&n.push({type:P.RECAP,text:`${i.fullName} gets the start for ${a}.`}),n}getInningStartDescriptions(e){const t=1009*(e.index??0)+3*this.hash(String(e.inningNum??""))+(e.inningTop?7:11)+13*this.hash(`${e.score.start.away}-${e.score.start.home}`)+17*this.hash(JSON.stringify(e.runner?.result?.start??{}))+19*this.hash(String(e.count.start.outs??0)),s=e.inningTop?"top":"bottom",i=e.score.start.away,r=e.score.start.home,a=i===r?`It's tied ${i}-${r}`:i>r?`The visitors lead ${i}-${r}`:`The home team leads ${r}-${i}`,n=e.count.start.outs,o=0===n?"no outs":1===n?"one out":2===n?"two outs":`${n} outs`,l=1===n?`There's ${o}`:`There are ${o}`,c=this.getRunnersPhrase(e.runner.result.start),h=this.ordinal(e.inningNum),d=[()=>`We move to the ${s} of the ${h}. ${a}. ${l} and ${c}.`,()=>`Now in the ${s} of the ${h}. ${a}. ${l} with ${c}.`,()=>`To the ${s} of the ${h} we go. ${a}. ${l}; ${c}.`,()=>`Here in the ${s} of the ${h}. ${a}. ${l} and ${c}.`,()=>`${s[0].toUpperCase()+s.slice(1)} ${h}. ${a}. ${l} and ${c}.`];return[{type:P.RECAP,text:this.pick(d,t)()}]}getGameRecapDescriptions(e,t){const s=this.getTeamName(e.away),i=this.getTeamName(e.home),r=t.score.end?.away??t.score.start.away,a=t.score.end?.home??t.score.start.home,n=r===a?null:r>a?s:i,o=1009*(t.index??0)+3*this.hash(String(e._id??""))+7*this.hash(String(t.inningNum??""))+(t.inningTop?11:13)+17*this.hash(`${r}-${a}`),l=n?[()=>`${n} win it.`,()=>`${n} come away with the win.`,()=>`${n} take this one.`,()=>`Final: ${n} on top.`]:[()=>"This one ends in a tie.",()=>"They finish even.",()=>"All square at the end."],c=Math.abs(r-a),h=r===a?[]:1===c?[()=>"A one-run game to the end.",()=>"A tight one-run finish."]:c>=6?[()=>"A comfortable win in the end.",()=>"They pull away for the win."]:[()=>"A solid win in the end.",()=>"They get it done today."],d=[{type:P.RECAP,text:this.pick([()=>"That's the ballgame.",()=>"And this one is over.",()=>"Ballgame."],o)()},{type:P.RECAP,text:this.pick(l,o+23)()}];return h.length>0&&d.push({type:P.RECAP,text:this.pick(h,o+41)()}),d.push({type:P.RECAP,text:`The final score is ${r} - ${a}.`}),d}getPlayResultDescription(s,i,r,a){const o=[],h=1009*(s.index??0)+this.hash(String(s.hitterId??""))+3*this.hash(String(s.pitcherId??""))+7*this.hash(String(s.fielderId??""))+11*this.hash(String(s.result??""))+13*this.hash(String(s.officialPlayResult??"")),d=i?.fullName??"The batter",u=r?.fullName??"the fielder",p=s.fielder?this.getPositionDescriptionNoun(s.fielder):"fielder",m=s.fielder?this.getPositionDescription(s.fielder):"field",g=s?.contact?.type??s.contact,f="GROUND_BALL"===g||"GB"===g||"GROUND"===g||0===g||g===t.GROUNDBALL,$="POPUP"===g||"PU"===g||"POP_FLY"===g,v="LINE_DRIVE"===g||"LD"===g||g===t.LINE_DRIVE,y="FLY_BALL"===g||"FB"===g||"FLY"===g||g===t.FLY_BALL,b=this.isToOF(s.fielder),R=()=>this.getContactDescription(s.contact,b,this.isHit(s.result))?.trim()??"",I=()=>$?"blooper":v?"line-drive":f?"ground-ball":y?"fly-ball":this.tidy(R().replace(/^(a|an)\s+/i,"").replace(/\s+ball$/i,"")),T=()=>b?this.tidy(`to the ${this.getShallowDeepDescription(s.shallowDeep)} ${m}`):f?"through the infield":"past the infield",S=s.runner?.events?.find(e=>e.movement?.start===n.FIRST),E=s.runner?.events?.find(e=>e.movement?.start===n.SECOND),w=s.runner?.events?.find(e=>e.movement?.start===n.THIRD),B=w?.movement?.isOut?w:E?.movement?.isOut?E:S?.movement?.isOut?S:void 0,x=B?.movement?.outBase,N=()=>this.getContactDescriptionOut(s.contact,b)??"is retired",D=[()=>`${d} strikes out.`,()=>`${d} goes down on strikes for the strikeout.`,()=>`Strike three. ${d} strikes out.`],_=[()=>`${d} draws a walk.`,()=>`${d} takes ball four for a walk.`,()=>`Ball four. ${d} reaches on a walk.`],L=[()=>`${d} gets hit by a pitch.`,()=>`Hit by pitch. ${d} takes first.`,()=>`${d} is clipped and will head to first base.`],O=[()=>`${d} ${N()} to ${p} ${u}.`,()=>{return`${d} ${N()} to ${u} ${e=s.fielder,e===l.LEFT_FIELD||e===l.CENTER_FIELD||e===l.RIGHT_FIELD?"in":"at"} ${m}.`;var e},()=>`${d} ${N()} and ${u} makes the play.`].map(e=>()=>this.tidy(e())),A=[()=>`${d} chops a ground ball through the infield for a single.`,()=>`${d} bounces a grounder through the right side for a single.`,()=>`${d} hits a grounder that finds a hole for a single.`],C=[()=>`${d} hits a ${I()} single ${T()}.`,()=>`${d} lines a ${I()} single ${T()}.`,()=>`${d} drops a ${I()} single ${T()}.`].map(e=>()=>this.tidy(e())),F=[()=>`${d} hits a ${I()} double ${T()}.`,()=>`${d} drives a ${I()} double ${T()}.`,()=>`${d} rips a ${I()} double ${T()}.`].map(e=>()=>this.tidy(e())),H=[()=>`${d} hits a ${I()} triple ${T()}.`,()=>`${d} drives a ${I()} triple ${T()}.`,()=>`${d} legs out a ${I()} triple ${T()}.`].map(e=>()=>this.tidy(e())),k=[()=>`${d} hits a home run.`,()=>`${d} launches a home run.`,()=>`Home run for ${d}.`],U=[e=>`${d} puts it in play to ${p} ${u}. The lead runner is out at ${e}. Fielder's choice.`,e=>`${d} puts it on the ground to ${p} ${u}. The throw goes to ${e} for the out. Fielder's choice.`,e=>`${d} ${N()} to ${p} ${u}. They get the lead runner at ${e}. Fielder's choice.`].map(e=>t=>this.tidy(e(t))),G=[e=>`${d} ${N()} to ${p} ${u}. Throw to ${e} for one, relay to first for the double play.`,e=>`${d} rolls it to ${p} ${u}. ${e} gets the lead runner, and the relay completes the double play.`,e=>`${d} ${N()} and it's turned. Out at ${e}, and the double play to first.`].map(e=>t=>this.tidy(e(t)));switch(s.result){case e.STRIKEOUT:o.push({type:P.RESULT,text:this.pick(D,h)()});break;case e.BB:o.push({type:P.RESULT,text:this.pick(_,h)()});break;case e.HIT_BY_PITCH:o.push({type:P.RESULT,text:this.pick(L,h)()});break;case e.OUT:s.officialPlayResult===c.FIELDERS_CHOICE&&x?o.push({type:P.RESULT,text:this.pick(U,h)(String(x))}):s.officialPlayResult===c.GROUNDED_INTO_DP&&x?o.push({type:P.RESULT,text:this.pick(G,h)(String(x))}):o.push({type:P.RESULT,text:this.pick(O,h)()});break;case e.SINGLE:o.push({type:P.RESULT,text:this.pick(f?A:C,h)()});break;case e.DOUBLE:o.push({type:P.RESULT,text:this.pick(F,h)()});break;case e.TRIPLE:o.push({type:P.RESULT,text:this.pick(H,h)()});break;case e.HR:o.push({type:P.RESULT,text:this.pick(k,h)()})}for(const e of o)e.text=this.tidy(e.text);return a&&o.length>0&&(o[0].meta={pitch:a}),o}getMatchupDescription(e,t){const s=t?.fullName??"The batter",i=e.count.start.outs,r=0===i?"no outs":1===i?"one out":2===i?"two outs":`${i} outs`;return`That will bring up ${s}. ${1===i?`There's ${r}`:`There are ${r}`} and ${this.getRunnersPhrase(e.runner.result.start)}.`}getPitchDescription(e){const t=this.getPitchTypeFull(e.type).toLowerCase(),s=["Taken for a strike","Called a strike","Strike called"],i=["Taken for a ball","Ball","Just misses"],a=["The batter swings and misses","The batter comes up empty","The batter swings through it"],n=["The batter chases and misses","The batter goes after it and misses","The batter swings at a pitch out of the zone and misses"],o=["The batter fouls it straight back","The batter snaps it foul","Fouled straight back"],l=["The batter puts it in play","The batter swings and puts it in play","Contact made, ball in play"],c=["The batter is hit by the pitch","Hit by pitch"],h=(e.overallQuality??0)+7*(Number(e.type)||0)+13*(e.actualZone?String(e.actualZone).length:0)+(e.locQ?Math.floor(e.locQ):0),d=`${this.pick(["Here comes a","Now a","The pitch is a"],h+3)} ${t} ${e.result===r.BALL?this.describeZoneOffPlate(e.actualZone):this.describeZoneNeutral(e.actualZone)}.`;let u="";if(e.isWP)u=this.pick(["It skips past the catcher for a wild pitch","That one gets away for a wild pitch"],h+7);else if(e.isPB)u=this.pick(["It gets away from the catcher","Passed ball"],h+7);else switch(e.result){case r.IN_PLAY:u=this.pick(l,h+9);break;case r.FOUL:u=this.pick(o,h+9);break;case r.HBP:u=this.pick(c,h+9);break;case r.STRIKE:u=e.swing?this.pick(a,h+11):this.pick(s,h+11);break;case r.BALL:u=e.swing?this.pick(n,h+13):this.pick(i,h+11)}const p=e.result===r.STRIKE&&(e.count?.strikes??0)>=2,m=e.result===r.BALL&&(e.count?.balls??0)>=3;return[d,u?`${u}.`:"",e.count&&!p&&!m&&e.result!==r.IN_PLAY&&e.result!==r.HBP&&e.count?this.pick([e=>`The count is ${e.balls}-${e.strikes}`,e=>`Now ${e.balls}-${e.strikes}`],h+19)({balls:Math.min(e.count.balls??0,3),strikes:Math.min(e.count.strikes??0,2),outs:e.count.outs})+".":""].filter(Boolean).join(" ")}getRunnerRecapDescription(e,t){const s=[],i=t.runner?.events??[],r=t.pitchLog?.pitches?.length??0;for(const a of i){if(this.isBatterRunnerPrimaryEvent(t,a))continue;if("number"==typeof a.pitchIndex&&a.pitchIndex>=0&&a.pitchIndex<r)continue;const i=this.getRunnerDescription(e,a);i&&s.push({type:P.RECAP,text:i})}return s}getRunnerDescription(e,t){const s=this.getGamePlayers(e),i=t.runner?._id?s[t.runner._id]:void 0,r=i?.fullName??"A runner",a=t.throw?.from?._id?s[t.throw.from._id]:void 0,o=t.movement?.outBase??t.movement?.end,l=t.movement?.start,c=t.movement?.end;return t.movement?.isOut?a&&t.throw?.from?.position?t.isSBAttempt?`${r} is caught stealing at ${o} on the throw from the ${this.getPositionDescriptionNoun(t.throw.from.position)} ${a.fullName}.`:`${r} is out at ${o} on the throw from the ${this.getPositionDescriptionNoun(t.throw.from.position)} ${a.fullName}.`:`${r} is out.`:c===n.HOME?`${r} scores from ${l}${t.isError?" [Error]":""}.`:t.isSBAttempt?a&&t.throw?.from?.position?`${r} steals ${c} with a throw from the ${this.getPositionDescriptionNoun(t.throw.from.position)} ${a.fullName}.`:`${r} steals ${c}.`:t.isPB?`${r} moves to ${c} on a passed ball.`:t.isWP?`${r} moves to ${c} on a wild pitch.`:t.eventType===h.TAGGED_FIRST_TO_SECOND||t.eventType===h.TAGGED_SECOND_TO_THIRD||t.eventType===h.TAGGED_THIRD_TO_HOME?`${r} tags up and advances to ${c} from ${l}.`:`${r} advances to ${c}${t.isError?" [Error]":""}.`}getSubstitutionDescriptions(e,t){const s=[],i=(e.substitutions??[]).filter(e=>e.playIndex===t.index).sort((e,t)=>e.isPitchingChange===t.isPitchingChange?0:e.isPitchingChange?1:-1);for(const t of i){const i=this.getGamePlayers(e),r=t.teamId===e.away._id?e.away:e.home,a=this.getTeamName(r),n=i[t.outPlayerId],o=i[t.inPlayerId];if(!o)continue;const l=this.getSubstitutionDescriptionSeed(e,t);let c;if(t.isPitchingChange)c=n?this.pickSubstitutionText([`Pitching change for ${a}. ${o.fullName} takes over for ${n.fullName}.`,`A call to the bullpen for ${a}. ${o.fullName} replaces ${n.fullName}.`,`That's all for ${n.fullName}. ${o.fullName} is the new pitcher for ${a}.`,`A new pitcher for ${a}. ${o.fullName} comes on in relief of ${n.fullName}.`,`${o.fullName} enters for ${a}, replacing ${n.fullName} on the mound.`],l):this.pickSubstitutionText([`Pitching change for ${a}. ${o.fullName} takes over on the mound.`,`A call to the bullpen for ${a}. ${o.fullName} is the new pitcher.`,`A new pitcher for ${a}. ${o.fullName} comes on in relief.`,`${o.fullName} enters to pitch for ${a}.`],l);else if(t.requiresPitcherChange)c=n?this.pickSubstitutionText([`Pinch hitter for ${a}. ${o.fullName} will bat for ${n.fullName}.`,`A move to the bench for ${a}. ${o.fullName} bats in place of ${n.fullName}.`,`${o.fullName} comes off the bench to hit for ${n.fullName}.`,`An offensive change for ${a}. ${o.fullName} will hit for ${n.fullName}.`,`${o.fullName} is announced as a pinch hitter for ${n.fullName}.`],l):this.pickSubstitutionText([`Pinch hitter for ${a}. ${o.fullName} steps in.`,`A move to the bench for ${a}. ${o.fullName} will hit.`,`${o.fullName} comes off the bench as a pinch hitter.`,`An offensive change for ${a}. ${o.fullName} will bat.`],l);else{const e=t.toPosition?this.getPositionDescription(t.toPosition):void 0;c=n?this.getLineupSubstitutionText(a,o.fullName,n.fullName,e,l):this.getLineupSubstitutionTextWithoutOutgoingPlayer(a,o.fullName,e,l)}s.push({type:P.SUBSTITUTION,text:c})}return s}getLineupSubstitutionText(e,t,s,i,r){return i?this.pickSubstitutionText([`Defensive change for ${e}. ${t} takes over at ${i}.`,`A defensive substitution for ${e}. ${t} replaces ${s} at ${i}.`,`${t} enters the game at ${i} for ${e}.`,`A defensive move for ${e}. ${t} is now at ${i}.`,`${t} comes in for ${s} and takes over at ${i}.`],r):this.pickSubstitutionText([`A substitution for ${e}. ${t} replaces ${s}.`,`${t} enters the game for ${e}, replacing ${s}.`,`A new player for ${e}. ${t} replaces ${s}.`],r)}getLineupSubstitutionTextWithoutOutgoingPlayer(e,t,s,i){return s?this.pickSubstitutionText([`Defensive change for ${e}. ${t} takes over at ${s}.`,`A defensive substitution for ${e}. ${t} enters at ${s}.`,`${t} enters the game at ${s} for ${e}.`,`A defensive move for ${e}. ${t} is now at ${s}.`],i):this.pickSubstitutionText([`A substitution for ${e}. ${t} enters the game.`,`${t} enters the game for ${e}.`,`A new player enters for ${e}. ${t} is into the game.`],i)}getSubstitutionDescriptionSeed(e,t){return this.hash([e._id||"",t.teamId||"",t.outPlayerId||"",t.inPlayerId||"",t.playIndex??0,t.lineupIndex??"",t.isPitchingChange?"P":"B"].join("|"))}getRunnersPhrase(e){const{first:t,second:s,third:i}=e;return t&&s&&i?"the bases loaded":t&&s?"runners on first and second":t&&i?"runners on first and third":s&&i?"runners on second and third":t?"a runner on first":s?"a runner on second":i?"a runner on third":"the bases empty"}describeZoneNeutral(e){const[t,s]=String(e).split("_"),i="LOW"===t?"low":"MID"===t?"middle":"high",r="AWAY"===s?"away":"MIDDLE"===s?"over the plate":"inside";return"over the plate"===r?`${i} ${r}`:`${i} and ${r}`}describeZoneOffPlate(e){const[t,s]=String(e).split("_"),i="LOW"===t?"low":"MID"===t?"just off the plate":"high",r="AWAY"===s?"the outside corner":"INSIDE"===s?"the inside corner":"the plate";return"MID"===t&&"MIDDLE"===s?"just off the plate":"MID"===t?`just off ${r}`:"MIDDLE"===s?`${i}, just off the plate`:`${i}, just off ${r}`}getContactDescription(e,s,i){switch(e){case t.FLY_BALL:return s?"a fly ball":"a popup";case t.GROUNDBALL:return i?"a ground ball":"a grounder";case t.LINE_DRIVE:return"a line drive"}}getContactDescriptionOut(e,s){switch(e){case t.FLY_BALL:return s?"flies out":"pops out";case t.GROUNDBALL:return"grounds out";case t.LINE_DRIVE:return"lines out"}}getShallowDeepDescription(e){return e!==s.NORMAL&&e?String(e).toLowerCase():""}getPositionDescription(e){switch(e){case l.PITCHER:return"pitcher";case l.CATCHER:return"catcher";case l.FIRST_BASE:return"first base";case l.SECOND_BASE:return"second base";case l.THIRD_BASE:return"third base";case l.SHORTSTOP:return"shortstop";case l.LEFT_FIELD:return"left field";case l.CENTER_FIELD:return"center field";case l.RIGHT_FIELD:return"right field";default:return String(e)}}getPositionDescriptionNoun(e){switch(e){case l.PITCHER:return"pitcher";case l.CATCHER:return"catcher";case l.FIRST_BASE:return"first baseman";case l.SECOND_BASE:return"second baseman";case l.THIRD_BASE:return"third baseman";case l.SHORTSTOP:return"shortstop";case l.LEFT_FIELD:return"left fielder";case l.CENTER_FIELD:return"center fielder";case l.RIGHT_FIELD:return"right fielder";default:return String(e)}}getPitchTypeFull(e){switch(e){case a.FF:return"Fastball";case a.CU:return"Curveball";case a.CH:return"Changeup";case a.FC:return"Cutter";case a.FO:return"Forkball";case a.KN:return"Knuckleball";case a.KC:return"Knuckle Curve";case a.SC:return"Screwball";case a.SI:return"Sinker";case a.SL:return"Slider";case a.SV:return"Slurve";case a.FS:return"Splitter";case a.ST:return"Slutter";default:return String(e)}}getGamePlayers(e){const t=[...e.away.players??[],...e.home.players??[]],s={};for(const e of t)s[e._id]=e;return s}getTeamName(e){return e.name||e.abbrev||"Team"}isBatterRunnerPrimaryEvent(e,t){return t.runner?._id===e.hitterId&&t.movement?.start===n.HOME}isGameEndingPlay(e,t){return!!e.isFinished&&t.index===e.playIndex}isHit(t){return t===e.SINGLE||t===e.DOUBLE||t===e.TRIPLE||t===e.HR}isToOF(e){return e===l.LEFT_FIELD||e===l.CENTER_FIELD||e===l.RIGHT_FIELD}getOutsPhrase(e){return 1===e?"is one out":`are ${e} outs`}ordinal(e){const t=e%100;if(t>=11&&t<=13)return`${e}th`;switch(e%10){case 1:return`${e}st`;case 2:return`${e}nd`;case 3:return`${e}rd`;default:return`${e}th`}}hash(e){let t=2166136261;for(let s=0;s<e.length;s++)t^=e.charCodeAt(s),t=Math.imul(t,16777619);return t>>>0}pick(e,t){return e[Math.abs(t)%e.length]}pickSubstitutionText(e,t){return this.pick(e,t)}tidy(e){return e.replace(/\s+/g," ").trim()}}!function(e){e.RECAP="RECAP",e.RESULT="RESULT",e.SUBSTITUTION="SUBSTITUTION"}(P||(P={}));class w{playByPlayService;constructor(e){this.playByPlayService=e}getGameViewModel(e){const t=this.getLineScore(e),s={side:"AWAY",team:e.away,isComplete:e.isComplete,isTopInning:e.isTopInning},i={side:"HOME",team:e.home,isComplete:e.isComplete,isTopInning:e.isTopInning},r={game:e,linescore:t,awayBoxscore:s,homeBoxscore:i,atBatBoxscore:e.isTopInning?s:i,isTopInning:e.isTopInning,currentInning:e.currentInning,balls:e.count?.balls??0,strikes:e.count?.strikes??0,outs:e.count?.outs??0,score:e.score,showHitter:!1,showPitcher:!1};if(!e.isStarted)return r;const a=this.getGamePlayers(e),n=this.getOffense(e),o=this.getDefense(e),c=this.getCurrentPlay(e),h=this.getHitter(e,c),d=this.getPitcher(e),u=this.getPlayer(a,n.runner1BId),p=this.getPlayer(a,n.runner2BId),m=this.getPlayer(a,n.runner3BId),g=e.isComplete?this.getPlayer(a,e.winningPitcherId):void 0,f=e.isComplete?this.getPlayer(a,e.losingPitcherId):void 0,$=this.getDefender(o,l.CATCHER),v=this.getDefender(o,l.FIRST_BASE),y=this.getDefender(o,l.SECOND_BASE),b=this.getDefender(o,l.THIRD_BASE),P=this.getDefender(o,l.SHORTSTOP),R=this.getDefender(o,l.LEFT_FIELD),I=this.getDefender(o,l.CENTER_FIELD),T=this.getDefender(o,l.RIGHT_FIELD);return{...r,runner1B:u,runner2B:p,runner3B:m,hitter:h,pitcher:d,awayPlayer:e.isTopInning?h:d,homePlayer:e.isTopInning?d:h,matchupHandedness:h&&d?this.getMatchupHandedness(h,d):void 0,defense:o,catcher:$,firstBase:v,secondBase:y,thirdBase:b,shortstop:P,leftField:R,centerField:I,rightField:T,winningPitcher:g,losingPitcher:f,showHitter:void 0!==h,showPitcher:void 0!==d}}getLineScore(e){const t=Math.max(9,e.currentInning),s=Array(t).fill(void 0),i=Array(t).fill(void 0);let r=0,a=0,n=0,o=0;for(const t of e.halfInnings??[]){const e=t.num-1,l=t.linescore?.runs??0,c=t.linescore?.hits??0,h=t.linescore?.errors??0;t.top?(s[e]=l,r+=c,n+=h):(i[e]=l,a+=c,o+=h)}return{currentInning:e.currentInning,isTopInning:e.isTopInning,isComplete:e.isComplete,away:{name:e.away.abbrev,innings:s,runs:e.score.away,hits:r,errors:n},home:{name:e.home.abbrev,innings:i,runs:e.score.home,hits:a,errors:o}}}getCurrentDescriptions(e){const t=[],s=this.getAtBatState(e)===R.ENDED?this.getLastPlay(e):this.getCurrentPlay(e);return 0===(e.halfInnings?.length??0)?t.push(...this.playByPlayService.getGameStartDescriptions(e)):s&&this.isFirstPlayOfHalfInning(e,s)&&t.push(...this.playByPlayService.getInningStartDescriptions(s)),s&&t.push(...this.playByPlayService.getPlayDescriptions(e,s)),t}getPlayByPlay(e){return this.playByPlayService.getPlayByPlay(e)}getAtBatState(e){const t=this.getCurrentPlay(e);return t?(t.pitchLog?.pitches?.length??0)>0?R.ONGOING:R.STARTED:void 0!==this.getLastPlay(e)?.result?R.ENDED:void 0}getCurrentPlay(e){const t=this.getPlays(e);for(let e=t.length-1;e>=0;e--)if(void 0===t[e].result)return t[e]}getLastPlay(e){const t=this.getPlays(e);for(let e=t.length-1;e>=0;e--)if(void 0!==t[e].result)return t[e]}getPlays(e){return(e.halfInnings??[]).flatMap(e=>e.plays??[])}getGamePlayers(e){const t={};for(const s of[...e.away.players,...e.home.players])t[s._id]=s;return t}getOffense(e){return e.isTopInning?e.away:e.home}getDefense(e){return e.isTopInning?e.home:e.away}getHitter(e,t=this.getCurrentPlay(e)){if(!e.isComplete&&t)return this.getGamePlayers(e)[t.hitterId]}getPitcher(e){if(e.isComplete)return;const t=this.getDefense(e);return t.players.find(e=>e._id===t.currentPitcherId)}getMatchupHandedness(e,t){const s=e.hits===o.S?t.throws===o.L?o.R:o.L:e.hits;return{throws:t.throws,hits:s,vsSameHand:s===t.throws}}getPlayer(e,t){return t?e[t]:void 0}getDefender(e,t){return e.players.find(e=>e.currentPosition===t)}isFirstPlayOfHalfInning(e,t){const s=(e.halfInnings??[]).find(e=>e.num===t.inningNum&&e.top===t.inningTop);return s?.plays?.[0]?.index===t.index}}class B{playByPlayService;constructor(e){this.playByPlayService=e}getEffectiveHittingRatings(e,t){return t===o.R?e.hittingRatings.vsR:e.hittingRatings.vsL}getEffectivePitchRatings(e,t){const s=t===o.R?e.pitchRatings.vsR:e.pitchRatings.vsL;return{power:e.pitchRatings.power,control:s.control,movement:s.movement}}getPitcherRatingsText(e,t){const s=this.getEffectivePitchRatings(e,t);return`POW ${s.power.toFixed(0)}, CON ${s.control.toFixed(0)}, MOV ${s.movement.toFixed(0)}`}getHitterRatingsText(e,t){const s=this.getEffectiveHittingRatings(e,t);return`CON ${s.contact.toFixed(0)}, GAP ${s.gapPower.toFixed(0)}, HR ${s.homerunPower.toFixed(0)}, EYE ${s.plateDiscipline.toFixed(0)}`}getPitcherGameStats(e){return`${e.pitchResult.ip} IP, ${e.pitchResult.er} ER, ${e.pitchResult.so} K, ${e.pitchResult.bb} BB, ${e.pitchResult.pitches} PC`}getPitcherGameStatsShort(e){return`${e.pitchResult.ip} IP, ${e.pitchResult.er} ER, ${e.pitchResult.so} K`}getHitterGameStats(e){const t=[];return t.push(`${e.hitResult.hits}/${e.hitResult.atBats}`),e.hitResult.bb>0&&t.push(`${e.hitResult.bb>1?e.hitResult.bb:""} BB`.trim()),e.hitResult.hbp>0&&t.push(`${e.hitResult.hbp>1?e.hitResult.hbp:""} HBP`.trim()),e.hitResult.doubles>0&&t.push(`${e.hitResult.doubles>1?e.hitResult.doubles:""} 2B`.trim()),e.hitResult.triples>0&&t.push(`${e.hitResult.triples>1?e.hitResult.triples:""} 3B`.trim()),e.hitResult.homeRuns>0&&t.push(`${e.hitResult.homeRuns>1?e.hitResult.homeRuns:""} HR`.trim()),e.hitResult.rbi>0&&t.push(`${e.hitResult.rbi>1?e.hitResult.rbi:""} RBI`.trim()),t.join(", ")}getHitterGameStatsShort(e){return`${e.hitResult.hits}/${e.hitResult.atBats}`}getPitchHeader(e){if(!e.quality)return"";const t=e.count?.balls??0,s=e.count?.strikes??0;return`${this.getPitchResultDescription(e)} - ${t}-${s} - ${e.quality.velocity?.toFixed(1)} MPH ${this.playByPlayService.getPitchTypeFull(e.type)}`}getInPlayHeader(e){return e.contactQuality?`EV ${e.contactQuality.exitVelocity.toFixed(1)} MPH / LA ${e.contactQuality.launchAngle.toFixed(1)}° / Dst ${e.contactQuality.distance?.toFixed(0)} ft`:""}getPitchResultDescription(e){if(e.isWP)return"Wild Pitch";if(e.isPB)return"Passed Ball";switch(e.result){case r.BALL:return"Ball";case r.STRIKE:return e.swing?"Swinging Strike":"Called Strike";case r.FOUL:return"Foul Ball";case r.IN_PLAY:return"In Play";default:return e.swing?"Swinging Strike":"Ball"}}getNumberWithOrdinal(e){const t=e%100;if(t>=11&&t<=13)return`${e}th`;switch(e%10){case 1:return`${e}st`;case 2:return`${e}nd`;case 3:return`${e}rd`;default:return`${e}th`}}getBalls(e,t){return Array.from({length:e},(e,s)=>s<t?"🟡":"⚪").join("")}getMessagesFromPlayDescriptions(e){return e.map(e=>{const t={text:e.text,type:"received",name:"Gamelog"};return e.meta?.pitch&&(e.type===P.RESULT?t.header=this.getInPlayHeader(e.meta.pitch):t.header=this.getPitchHeader(e.meta.pitch)),t})}}!function(e){e.STARTED="STARTED",e.ONGOING="ONGOING",e.ENDED="ENDED"}(R||(R={}));class x{getBoxscoreInfo(e,t){const s=t.team.lineupIds,i=t.team._id,r=t.team.players,a=e.filter(e=>e.teamId===i).sort((e,t)=>(e.playIndex??0)-(t.playIndex??0)),n=this.getSubNumberByPlayerId(a),o=a.filter(e=>e.isPitchingChange),l=a.filter(e=>void 0!==e.lineupIndex),c=this.getBatterAppearanceIds(s,l),h=this.getPitcherAppearanceIds(o),d=this.getRowsFromSubstitutions(c,r,n,e=>s.includes(e._id)||this.hasBattingLine(e)),u=this.getRowsFromSubstitutions(h,r,n,e=>e._id===t.team.currentPitcherId||this.hasPitchingLine(e)),p=r.filter(e=>e.hitResult.doubles>0).map(e=>this.getStatSummary(e,e.hitResult.doubles)),m=r.filter(e=>e.hitResult.triples>0).map(e=>this.getStatSummary(e,e.hitResult.triples)),g=r.filter(e=>e.hitResult.homeRuns>0).map(e=>this.getStatSummary(e,e.hitResult.homeRuns)),f=r.map(e=>({player:e,totalBases:this.getTotalBases(e)})).filter(e=>e.totalBases>0).map(e=>this.getStatSummary(e.player,e.totalBases)),$=r.filter(e=>e.hitResult.rbi>0).map(e=>this.getStatSummary(e,e.hitResult.rbi));return{lineup:s,batters:d,pitchers:u,doubles:p,triples:m,homeRuns:g,totalBases:f,rbi:$}}getSubNumberByPlayerId(e){const t=new Map;let s=1;for(const i of e)i.inPlayerId&&!t.has(i.inPlayerId)&&(t.set(i.inPlayerId,s),s++);return t}getRowsFromSubstitutions(e,t,s,i){const r=[],a=new Set;for(const n of e){const e=this.getPlayer(t,n);e&&i(e)&&(r.push({player:e,subNumber:s.get(e._id)}),a.add(e._id))}for(const e of t)!a.has(e._id)&&i(e)&&(r.push({player:e,subNumber:s.get(e._id)}),a.add(e._id));return r}getPlayer(e,t){return e.find(e=>e._id===t)}hasBattingLine(e){return e.hitResult.atBats>0||e.hitResult.runs>0||e.hitResult.hits>0||e.hitResult.doubles>0||e.hitResult.triples>0||e.hitResult.homeRuns>0||e.hitResult.rbi>0||e.hitResult.bb>0||e.hitResult.hbp>0||e.hitResult.so>0}hasPitchingLine(e){return e.pitchResult.battersFaced>0||e.pitchResult.pitches>0||e.pitchResult.strikes>0||e.pitchResult.hits>0||e.pitchResult.runs>0||e.pitchResult.er>0||e.pitchResult.homeRuns>0||e.pitchResult.bb>0||e.pitchResult.so>0||e.pitchResult.hbp>0}getPitcherAppearanceIds(e){const t=[...e].sort((e,t)=>(e.playIndex??0)-(t.playIndex??0)),s=[],i=new Set,r=e=>{e&&!i.has(e)&&(s.push(e),i.add(e))};t.length>0&&r(t[0].outPlayerId);for(const e of t)r(e.inPlayerId);return s}getBatterAppearanceIds(e,t){const s=t.filter(e=>void 0!==e.lineupIndex).sort((e,t)=>(e.playIndex??0)-(t.playIndex??0)),i=[...e];for(const e of[...s].reverse())void 0!==e.lineupIndex&&i[e.lineupIndex]===e.inPlayerId&&(i[e.lineupIndex]=e.outPlayerId);const r=[],a=new Set,n=e=>{e&&!a.has(e)&&(r.push(e),a.add(e))};for(let e=0;e<i.length;e++){n(i[e]);for(const t of s)t.lineupIndex===e&&n(t.inPlayerId)}return r}getTotalBases(e){return e.hitResult.hits-e.hitResult.doubles-e.hitResult.triples-e.hitResult.homeRuns+2*e.hitResult.doubles+3*e.hitResult.triples+4*e.hitResult.homeRuns}getStatSummary(e,t){return{playerId:e._id,name:e.fullName,value:t}}}class N{getSync(e,t){const s=e.length>0&&!this.isSameMessage(e[0],t[0]);return{clear:s,messages:s?t:this.getNewMessages(e,t)}}getNewMessages(e,t){let s=0;for(;s<e.length&&s<t.length&&this.isSameMessage(e[s],t[s]);)s++;return t.slice(s)}isSameMessage(e,t){return Boolean(e&&t&&e.text===t.text&&e.type===t.type)}}var D=S(391),_=S.n(D);const L={randomUUID:"undefined"!=typeof crypto&&crypto.randomUUID&&crypto.randomUUID.bind(crypto)};let O;const A=new Uint8Array(16);function C(){if(!O&&(O="undefined"!=typeof crypto&&crypto.getRandomValues&&crypto.getRandomValues.bind(crypto),!O))throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");return O(A)}const F=[];for(let e=0;e<256;++e)F.push((e+256).toString(16).slice(1));const H=function(e,t,s){if(L.randomUUID&&!t&&!e)return L.randomUUID();const i=(e=e||{}).random||(e.rng||C)();if(i[6]=15&i[6]|64,i[8]=63&i[8]|128,t){s=s||0;for(let e=0;e<16;++e)t[s+e]=i[e];return t}return function(e,t=0){return F[e[t+0]]+F[e[t+1]]+F[e[t+2]]+F[e[t+3]]+"-"+F[e[t+4]]+F[e[t+5]]+"-"+F[e[t+6]]+F[e[t+7]]+"-"+F[e[t+8]]+F[e[t+9]]+"-"+F[e[t+10]]+F[e[t+11]]+F[e[t+12]]+F[e[t+13]]+F[e[t+14]]+F[e[t+15]]}(i)},k=15e3;class U{simService;game;rng;timer;pitchIntervalMs=k;automatic=!0;paused=!1;onUpdate;onComplete;constructor(e){this.simService=e}start(e,t={}){this.reset();const s={_id:H()},i=t.seed??s._id;this.pitchIntervalMs=t.pitchIntervalMs??k,this.automatic=t.automatic??!0,this.paused=!1,this.onUpdate=t.onUpdate,this.onComplete=t.onComplete,this.rng=t.rng??_()(i,{state:!0});const r=structuredClone(e);return r.game=s,r.date=new Date(e.date),this.simService.initGame(s),this.game=this.simService.startGame(r),this.onUpdate?.(this.game),this.automatic&&this.scheduleNextPitch(),this.game}load(e,t,s={}){return this.reset(),this.game=e,this.pitchIntervalMs=s.pitchIntervalMs??k,this.automatic=s.automatic??!0,this.paused=!1,this.onUpdate=s.onUpdate,this.onComplete=s.onComplete,this.rng=s.rng??_()("",{state:structuredClone(t.rngState)}),this.onUpdate?.(this.game),this.automatic&&!this.game.isFinished&&this.scheduleNextPitch(),this.game}advance(){if(!this.game||!this.rng)throw new Error("Game playback has not been started.");return this.game.isFinished||(this.game.isComplete||this.simService.simPitch(this.game,this.rng),this.game.isComplete&&!this.game.isFinished&&this.simService.finishGame(this.game),this.onUpdate?.(this.game),this.game.isFinished&&(this.clearTimer(),this.onComplete?.(this.game))),this.game}pause(){this.paused=!0,this.clearTimer()}resume(){this.game&&!this.game.isFinished&&this.automatic&&(this.paused=!1,this.scheduleNextPitch())}stop(){this.clearTimer(),this.automatic=!1,this.paused=!1}reset(){this.clearTimer(),this.game=void 0,this.rng=void 0,this.onUpdate=void 0,this.onComplete=void 0,this.pitchIntervalMs=k,this.automatic=!0,this.paused=!1}setAutomatic(e){this.automatic=e,this.clearTimer(),e&&this.game&&!this.game.isFinished&&!this.paused&&this.scheduleNextPitch()}setPitchInterval(e){if(!Number.isFinite(e)||e<0)throw new Error(`Invalid game playback interval: ${e}.`);this.pitchIntervalMs=e,this.automatic&&this.game&&!this.game.isFinished&&!this.paused&&(this.clearTimer(),this.scheduleNextPitch())}setCallbacks(e,t){this.onUpdate=e,this.onComplete=t}getGame(){return this.game}getPlaybackState(){if(!this.rng)throw new Error("Game playback has not been started.");if(!this.rng.state)throw new Error("The current random number generator does not support state persistence.");return{rngState:structuredClone(this.rng.state())}}isAutomatic(){return this.automatic}isPaused(){return this.paused}scheduleNextPitch(){!this.game||this.game.isFinished||this.paused||!this.automatic||this.timer||(this.timer=setTimeout(()=>{this.timer=void 0,this.advance(),this.game&&!this.game.isFinished&&!this.paused&&this.automatic&&this.scheduleNextPitch()},this.pitchIntervalMs))}clearTimer(){void 0!==this.timer&&(clearTimeout(this.timer),this.timer=void 0)}}class G{getStartingPitcher(e){const t=this.getPlayer(e,e.startingPitcher._id);if(!t)throw new Error(`Starting pitcher ${e.startingPitcher._id} was not found.`);return t}getDisplayHitters(e){return e.lineup.order.map(t=>this.getPlayer(e,t._id)).filter(e=>void 0!==e)}getDisplayAvailableHitters(e){const t=new Set(e.lineup.order.map(e=>e._id));return e.players.filter(e=>!this.isPitcher(e)&&!t.has(e._id))}getDisplayAvailablePitchers(e){return e.availablePitchers.map(t=>({...this.getRequiredPlayer(e,t.playerId),role:t.role,priority:t.priority}))}setStartingPitcher(e,t){const s=this.getRequiredPlayer(e,t);if(!this.isPitcher(s))throw new Error(`Invalid starting pitcher: ${t}.`);if(e.startingPitcher._id===t)return;const i=e.startingPitcher._id,r=e.availablePitchers.findIndex(e=>e.playerId===t);r>=0?e.availablePitchers[r].playerId=i:e.availablePitchers.push({playerId:i,role:f.MIDDLE,priority:this.getNextPriority(e.availablePitchers,f.MIDDLE)}),e.startingPitcher={_id:t}}moveHitter(e,t,s){const i=this.getRequiredPlayer(e,t),r=this.getRequiredPlayer(e,s);if(this.isPitcher(i)||this.isPitcher(r))throw new Error("Pitchers cannot be moved through the hitter lineup.");const a=e.lineup.order.findIndex(e=>e._id===t),n=e.lineup.order.findIndex(e=>e._id===s);if(a>=0&&n>=0)this.swapLineupOrder(e,a,n);else if(a>=0)this.replaceLineupPlayer(e,a,r);else{if(!(n>=0))throw new Error("At least one hitter must currently be in the lineup.");this.replaceLineupPlayer(e,n,i)}}moveHitterToLineup(e,t,s){const i=this.getRequiredPlayer(e,t),r=e.lineup.order[s];if(!r)throw new Error(`Invalid lineup index: ${s}.`);if(this.isPitcher(i))throw new Error("Pitchers cannot be added to the hitting lineup.");const a=e.lineup.order.findIndex(e=>e._id===t);if(a>=0)this.swapLineupOrder(e,a,s);else{if(!this.playerCanPlay(i,r.position))throw new Error(`${i.fullName} cannot play ${r.position}.`);e.lineup.order[s]={...r,_id:t}}}moveBullpenPitcher(e,t,s){const i=this.getRequiredPlayer(e,t),r=this.getRequiredPlayer(e,s);if(!this.isPitcher(i)||!this.isPitcher(r))throw new Error("Only pitchers can be moved in the bullpen.");if(t===e.startingPitcher._id)return void this.setStartingPitcher(e,s);if(s===e.startingPitcher._id)return void this.setStartingPitcher(e,t);const a=e.availablePitchers.findIndex(e=>e.playerId===t),n=e.availablePitchers.findIndex(e=>e.playerId===s);if(a<0||n<0)throw new Error("Both pitchers must have bullpen assignments.");const o=e.availablePitchers[a].playerId,l=e.availablePitchers[n].playerId;e.availablePitchers[a].playerId=l,e.availablePitchers[n].playerId=o}setBullpenRole(e,t,s,i=1){const r=this.getRequiredPlayer(e,t);if(!this.isPitcher(r))throw new Error(`${r.fullName} is not a pitcher.`);if(t===e.startingPitcher._id)throw new Error("The starting pitcher cannot have a bullpen role.");const a=e.availablePitchers.find(e=>e.playerId===t);if(a)return a.role=s,void(a.priority=i);e.availablePitchers.push({playerId:t,role:s,priority:i})}setBullpenPriority(e,t,s){if(!Number.isInteger(s)||s<1)throw new Error(`Invalid bullpen priority: ${s}.`);const i=e.availablePitchers.find(e=>e.playerId===t);if(!i)throw new Error(`Bullpen assignment for ${t} was not found.`);i.priority=s}getBullpenRoleDisplay(e){return e===f.CLOSER?"Closer":e===f.SETUP?"Setup":e===f.MIDDLE?"Middle Relief":e===f.LONG?"Long Relief":e===f.MOP_UP?"Mop Up":""}playerCanPlay(e,t){return this.getPositionFitScore(e,t)>0}getPlayer(e,t){if(t)return e.players.find(e=>e._id===t)}getRequiredPlayer(e,t){const s=this.getPlayer(e,t);if(!s)throw new Error(`Player ${t} was not found.`);return s}swapLineupOrder(e,t,s){const i=e.lineup.order[t];e.lineup.order[t]=e.lineup.order[s],e.lineup.order[s]=i}replaceLineupPlayer(e,t,s){const i=e.lineup.order[t];if(!this.playerCanPlay(s,i.position))throw new Error(`${s.fullName} cannot play ${i.position}.`);e.lineup.order[t]={...i,_id:s._id}}isPitcher(e){return e.primaryPosition===l.PITCHER}getPositionFitScore(e,t){return this.isPitcher(e)?0:t===l.DESIGNATED_HITTER?1:e.primaryPosition===t?100:0}getNextPriority(e,t){const s=e.filter(e=>e.role===t).map(e=>e.priority??0);return s.length>0?Math.max(...s)+1:1}}function M(e){let t=e.vm;return function(e){e.$;var s=e.$h;return e.$root,e.$f7,e.$f7route,e.$f7router,e.$theme,e.$update,e.$store,s`

  ${t?s`

    <table class="linescore">

      <thead>

        <tr>

          <th></th>

          ${Array.from({length:t.away.innings.length},(e,t)=>t+1).map(e=>s`

            <th>${e}</th>

          `)}

          <th>R</th>

          <th>H</th>

          <th>E</th>

        </tr>

      </thead>

      <tbody>

        <tr>

          <td>

            ${t.isTopInning&&!t.isComplete?s`

              <strong>${t.away.name}</strong>

            `:t.away.name}

          </td>

          ${t.away.innings.map((e,i)=>s`

            <td class="align-center ${t.currentInning===i+1&&t.isTopInning&&!t.isComplete?"current":""}">

              ${e??""}

            </td>

          `)}

          <td class="align-center">${t.away.runs}</td>

          <td class="align-center">${t.away.hits}</td>

          <td class="align-center">${t.away.errors}</td>

        </tr>

        <tr>

          <td>

            ${t.isTopInning||t.isComplete?t.home.name:s`

              <strong>${t.home.name}</strong>

            `}

          </td>

          ${t.home.innings.map((e,i)=>s`

            <td class="align-center ${t.currentInning!==i+1||t.isTopInning||t.isComplete?"":"current"}">

              ${e??""}

            </td>

          `)}

          <td class="align-center">${t.home.runs}</td>

          <td class="align-center">${t.home.hits}</td>

          <td class="align-center">${t.home.errors}</td>

        </tr>

      </tbody>

    </table>

  `:" "}

`}}M.id="38bc8383dd",M.style="\n\n";const W=M;function Y(e){let t=e.playbyplay??[],s=e.gameplayers??{},i=e.gameviewservice;return function(e){e.$;var r=e.$h;return e.$root,e.$f7,e.$f7route,e.$f7router,e.$theme,e.$update,e.$store,r`

  <div class="game-log">

    <div class="list cards-list">

      <ul>

        ${t.filter(e=>void 0!==e.play?.result).map(e=>r`

          <li class="card recap card-header-divider card-outline">

            <div class="card-header">

              ${e.play.inningTop?"Top of":"Bottom of"} ${i.getNumberWithOrdinal(e.play.inningNum)} Inning

              <div class="diamond-wrapper">

                <div class="diamond">

                  <div class="first base ${e.play.runner?.result?.end?.first?"runner":""}"></div>

                  <div class="second base ${e.play.runner?.result?.end?.second?"runner":""}"></div>

                  <div class="third base ${e.play.runner?.result?.end?.third?"runner":""}"></div>

                </div>

              </div>

            </div>

            <div class="card-content card-content-padding play-description">

              <div class="chip result">

                <div class="chip-label">${e.play.result}</div>

              </div>

              ${e.descriptions.map(e=>r`

                <div class="message message-received ${"RESULT"===e.type?"main":""}">

                  <div class="message-content">

                    ${e.meta?.pitch?r`

                      <div class="message-header">

                        ${"RESULT"===e.type?i.getInPlayHeader(e.meta.pitch):i.getPitchHeader(e.meta.pitch)}

                      </div>

                    `:" "}

                    <div class="message-bubble">

                      <div class="message-text">${e.text}</div>

                    </div>

                  </div>

                </div>

              `)}

              <div class="info-wrapper">

                <span class="label">Outs</span>

                ${i.getBalls(3,e.play.count?.end?.outs??0)}

              </div>

              ${e.play.credits?.length>0?r`

                <div class="defense">

                  <strong>Defense</strong>

                  <ul>

                    ${e.play.credits.map(e=>{const t=s[e._id];return r`

                        <li>

                          ${t?`${t.currentPosition} ${t.fullName}`:e._id} - ${e.type}

                        </li>

                      `})}

                  </ul>

                </div>

              `:" "}

            </div>

          </li>

        `)}

      </ul>

    </div>

  </div>

`}}Y.id="dabca28e21",Y.style="\n\n\n\n";const j=Y;function K(e,{$h:t}){let s=e.vm,i=e.gameviewservice,r=e.fieldimageurl,a=e.getplayerimageurl,n=e.getplayerhref,o=e.getboxscorehref,l=e.getgameloghref,c=e.advancecallback,h=e.pausecallback,d=e.resumecallback,u=e.simtoendcallback,p=e.awaycolor||"#0A3161",m=e.homecolor||"#B31942";const g=e=>{const t=String(e).replace("#","");return.299*parseInt(t.substring(0,2),16)+.587*parseInt(t.substring(2,4),16)+.114*parseInt(t.substring(4,6),16)>160?"#000000":"#ffffff"};let f=g(p),$=g(m);const v=e=>e.lineupIds.map(t=>e.players.find(e=>e._id===t)).filter(e=>e),y=e=>null==e?"color-gray":e>=146?"color-green":e>=122?"color-blue":e>=83?"color-yellow":e>=47?"color-orange":"color-red",b=e=>null==e?"":e>=170?"A+":e>=158?"A":e>=146?"A-":e>=134?"B+":e>=122?"B":e>=110?"B-":e>=95?"C+":e>=83?"C":e>=71?"C-":e>=59?"D+":e>=47?"D":e>=35?"D-":"F",P=async()=>{c&&await c()},R=async()=>{h&&await h()},I=async()=>{d&&await d()},T=async()=>{u&&await u()};return function(t){t.$;var c=t.$h;return t.$root,t.$f7,t.$f7route,t.$f7router,t.$theme,t.$update,t.$store,c`

  <div class="game-state ${s.isTopInning?"top-inning":"bottom-inning"}" style="--away-color: ${p}; --home-color: ${m}; --away-font-color: ${f}; --home-font-color: ${$};">

    <div class="game-summary">

      <div class="game-score">
        <table>
          <tr class="${s.isTopInning?"at-bat":""}">
            <td class="name" style="background-color: ${p}; color: ${f};">
              <strong>${s.game.away.abbrev}</strong>
            </td>
            <td class="runs">${s.score.away}</td>
            <td class="inning" rowspan="2">
              ${s.isTopInning?c`▲ ${s.currentInning}`:c`${s.currentInning} ▼`}
            </td>
          </tr>

          <tr class="${s.isTopInning?"":"at-bat"}">
            <td class="name" style="background-color: ${m}; color: ${$};">
              <strong>${s.game.home.abbrev}</strong>
            </td>
            <td class="runs">${s.score.home}</td>
          </tr>
        </table>
      </div>

      <div class="state-info">

        <div class="info-wrapper">
          <span class="label">B</span>${i.getBalls(3,s.balls)}<br />
          <span class="label">S</span>${i.getBalls(2,s.strikes)}<br />
          <span class="label">O</span>${i.getBalls(2,s.outs)}
        </div>

        <div class="diamond-wrapper">
          <div class="diamond">
            <div class="first base ${s.runner1B?"runner":""}"></div>
            <div class="second base ${s.runner2B?"runner":""}"></div>
            <div class="third base ${s.runner3B?"runner":""}"></div>
          </div>
        </div>

      </div>

    </div>


    <div class="game-main">

      <div class="left">
        <div class="content">

          <div class="card card-raised ${s.atBatBoxscore.team._id===s.awayBoxscore.team._id?"card-atbat":"card-notatbat"}">

            <div class="card-header">
              ${s.awayBoxscore.team.name??s.awayBoxscore.team.abbrev}
            </div>

            <div class="card-content card-content-padding">

              <table class="lineup">
                <thead>
                  <tr>
                    <th class="num order">#</th>
                    <th class="image"></th>
                    <th class="name">Name</th>
                    <th>Bats</th>
                    <th>POS</th>
                    <th class="stats">Today</th>
                  </tr>
                </thead>

                <tbody>

                  ${v(s.awayBoxscore.team).map((e,t)=>c`
                    <tr class="${s.atBatBoxscore.team._id===s.awayBoxscore.team._id&&s.awayBoxscore.team.currentHitterIndex===t?"at-bat":""}">

                      <td class="num order">${t+1}</td>

                      <td class="image">
                        ${a?c`
                          <img src="${a(e)}" />
                        `:c``}
                      </td>

                      <td class="name">
                        ${n?c`
                          <a href="${n(e)}">${e.displayName??e.fullName}</a>
                        `:c`
                          ${e.displayName??e.fullName}
                        `}
                      </td>

                      <td>${e.hits}</td>
                      <td class="pos">${e.currentPosition}</td>
                      <td class="stats">${i.getHitterGameStatsShort(e)}</td>

                    </tr>
                  `)}

                </tbody>
              </table>

            </div>
          </div>

        </div>
      </div>


      <div class="middle">

        <div class="game-info">

          <div class="field-layer">

            ${r?c`
              <img src="${r}" class="field-image" />
            `:c``}


            ${s.showHitter&&s.hitter?c`
              <a href="${n?n(s.hitter):"#"}" class="runner hitter offense-player ${"R"===s.matchupHandedness?.hits?"rhb":"lhb"}">

                ${"L"===s.matchupHandedness?.hits&&a?c`
                  <div class="image">
                    <img src="${a(s.hitter)}" />
                  </div>
                `:c``}

                <div class="wrapper">
                  <div class="text">${s.hitter.displayName??s.hitter.fullName}</div>

                  <div class="game-stats">
                    ${i.getHitterGameStatsShort(s.hitter)}
                  </div>
                </div>

                ${"R"===s.matchupHandedness?.hits&&a?c`
                  <div class="image">
                    <img src="${a(s.hitter)}" />
                  </div>
                `:c``}

              </a>
            `:c``}


            ${s.runner1B?c`
              <a href="${n?n(s.runner1B):"#"}" class="runner firstBase offense-player">

                ${a?c`
                  <div class="image">
                    <img src="${a(s.runner1B)}" />
                  </div>
                `:c``}

                <div class="wrapper">
                  <div class="text">${s.runner1B.displayName??s.runner1B.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${y(s.runner1B.hittingRatings.speed)}">${b(s.runner1B.hittingRatings.speed)}</div>
                      <div class="chip-label">SPD</div>
                    </div>
                  </div>
                </div>

              </a>
            `:c``}


            ${s.runner2B?c`
              <a href="${n?n(s.runner2B):"#"}" class="runner secondBase offense-player">

                <div class="wrapper">
                  <div class="text">${s.runner2B.displayName??s.runner2B.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${y(s.runner2B.hittingRatings.speed)}">${b(s.runner2B.hittingRatings.speed)}</div>
                      <div class="chip-label">SPD</div>
                    </div>
                  </div>
                </div>

                ${a?c`
                  <div class="image">
                    <img src="${a(s.runner2B)}" />
                  </div>
                `:c``}

              </a>
            `:c``}


            ${s.runner3B?c`
              <a href="${n?n(s.runner3B):"#"}" class="runner thirdBase offense-player">

                ${a?c`
                  <div class="image">
                    <img src="${a(s.runner3B)}" />
                  </div>
                `:c``}

                <div class="wrapper">
                  <div class="text">${s.runner3B.displayName??s.runner3B.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${y(s.runner3B.hittingRatings.speed)}">${b(s.runner3B.hittingRatings.speed)}</div>
                      <div class="chip-label">SPD</div>
                    </div>
                  </div>
                </div>

              </a>
            `:c``}


            ${s.showPitcher&&s.pitcher?c`
              <a href="${n?n(s.pitcher):"#"}" class="defender p defense-player" data-pos="P">

                <div class="wrapper">
                  <div class="text">${s.pitcher.displayName??s.pitcher.fullName}</div>

                  <div class="game-stats">
                    ${i.getPitcherGameStatsShort(s.pitcher)}
                  </div>
                </div>

                ${a?c`
                  <div class="image">
                    <img src="${a(s.pitcher)}" />
                  </div>
                `:c``}

              </a>
            `:c``}


            ${s.showPitcher&&s.catcher?c`
              <a href="${n?n(s.catcher):"#"}" class="defender c top defense-player" data-pos="C">

                ${a?c`
                  <div class="image">
                    <img src="${a(s.catcher)}" />
                  </div>
                `:c``}

                <div class="wrapper">
                  <div class="text">${s.catcher.displayName??s.catcher.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${y(s.catcher.hittingRatings.arm)}">${b(s.catcher.hittingRatings.arm)}</div>
                      <div class="chip-label">ARM</div>
                    </div>
                  </div>
                </div>

              </a>
            `:c``}


            ${s.showPitcher&&s.firstBase?c`
              <a href="${n?n(s.firstBase):"#"}" class="defender firstBase defense-player" data-pos="1B">

                <div class="wrapper">
                  <div class="text">${s.firstBase.displayName??s.firstBase.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${y(s.firstBase.hittingRatings.defense)}">${b(s.firstBase.hittingRatings.defense)}</div>
                      <div class="chip-label">DEF</div>
                    </div>
                  </div>
                </div>

                ${a?c`
                  <div class="image">
                    <img src="${a(s.firstBase)}" />
                  </div>
                `:c``}

              </a>
            `:c``}


            ${s.showPitcher&&s.secondBase?c`
              <a href="${n?n(s.secondBase):"#"}" class="defender secondBase defense-player" data-pos="2B">

                <div class="wrapper">
                  <div class="text">${s.secondBase.displayName??s.secondBase.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${y(s.secondBase.hittingRatings.defense)}">${b(s.secondBase.hittingRatings.defense)}</div>
                      <div class="chip-label">DEF</div>
                    </div>
                  </div>
                </div>

                ${a?c`
                  <div class="image">
                    <img src="${a(s.secondBase)}" />
                  </div>
                `:c``}

              </a>
            `:c``}


            ${s.showPitcher&&s.thirdBase?c`
              <a href="${n?n(s.thirdBase):"#"}" class="defender thirdBase defense-player" data-pos="3B">

                <div class="wrapper">
                  <div class="text">${s.thirdBase.displayName??s.thirdBase.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${y(s.thirdBase.hittingRatings.defense)}">${b(s.thirdBase.hittingRatings.defense)}</div>
                      <div class="chip-label">DEF</div>
                    </div>
                  </div>
                </div>

                ${a?c`
                  <div class="image">
                    <img src="${a(s.thirdBase)}" />
                  </div>
                `:c``}

              </a>
            `:c``}


            ${s.showPitcher&&s.shortstop?c`
              <a href="${n?n(s.shortstop):"#"}" class="defender ss defense-player" data-pos="SS">

                <div class="wrapper">
                  <div class="text">${s.shortstop.displayName??s.shortstop.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${y(s.shortstop.hittingRatings.defense)}">${b(s.shortstop.hittingRatings.defense)}</div>
                      <div class="chip-label">DEF</div>
                    </div>
                  </div>
                </div>

                ${a?c`
                  <div class="image">
                    <img src="${a(s.shortstop)}" />
                  </div>
                `:c``}

              </a>
            `:c``}


            ${s.showPitcher&&s.leftField?c`
              <a href="${n?n(s.leftField):"#"}" class="defender lf defense-player" data-pos="LF">

                <div class="wrapper">
                  <div class="text">${s.leftField.displayName??s.leftField.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${y(s.leftField.hittingRatings.defense)}">${b(s.leftField.hittingRatings.defense)}</div>
                      <div class="chip-label">DEF</div>
                    </div>
                  </div>
                </div>

                ${a?c`
                  <div class="image">
                    <img src="${a(s.leftField)}" />
                  </div>
                `:c``}

              </a>
            `:c``}


            ${s.showPitcher&&s.centerField?c`
              <a href="${n?n(s.centerField):"#"}" class="defender cf defense-player" data-pos="CF">

                <div class="wrapper">
                  <div class="text">${s.centerField.displayName??s.centerField.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${y(s.centerField.hittingRatings.defense)}">${b(s.centerField.hittingRatings.defense)}</div>
                      <div class="chip-label">DEF</div>
                    </div>
                  </div>
                </div>

                ${a?c`
                  <div class="image">
                    <img src="${a(s.centerField)}" />
                  </div>
                `:c``}

              </a>
            `:c``}


            ${s.showPitcher&&s.rightField?c`
              <a href="${n?n(s.rightField):"#"}" class="defender rf defense-player" data-pos="RF">

                <div class="wrapper">
                  <div class="text">${s.rightField.displayName??s.rightField.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${y(s.rightField.hittingRatings.defense)}">${b(s.rightField.hittingRatings.defense)}</div>
                      <div class="chip-label">DEF</div>
                    </div>
                  </div>
                </div>

                ${a?c`
                  <div class="image">
                    <img src="${a(s.rightField)}" />
                  </div>
                `:c``}

              </a>
            `:c``}


            <div class="at-bat-ended">
              <div class="card">
                <div class="card-content">
                  <div class="result-wrapper">
                    <div class="result"></div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>


      <div class="right">
        <div class="content">

          <div class="card card-raised ${s.atBatBoxscore.team._id===s.homeBoxscore.team._id?"card-atbat":"card-notatbat"}">

            <div class="card-header">
              ${s.homeBoxscore.team.name??s.homeBoxscore.team.abbrev}
            </div>

            <div class="card-content card-content-padding">

              <table class="lineup">
                <thead>
                  <tr>
                    <th class="num order">#</th>
                    <th class="image"></th>
                    <th class="name">Name</th>
                    <th>Bats</th>
                    <th>POS</th>
                    <th class="stats">Today</th>
                  </tr>
                </thead>

                <tbody>

                  ${v(s.homeBoxscore.team).map((e,t)=>c`
                    <tr class="${s.atBatBoxscore.team._id===s.homeBoxscore.team._id&&s.homeBoxscore.team.currentHitterIndex===t?"at-bat":""}">

                      <td class="num order">${t+1}</td>

                      <td class="image">
                        ${a?c`
                          <img src="${a(e)}" />
                        `:c``}
                      </td>

                      <td class="name">
                        ${n?c`
                          <a href="${n(e)}">${e.displayName??e.fullName}</a>
                        `:c`
                          ${e.displayName??e.fullName}
                        `}
                      </td>

                      <td>${e.hits}</td>
                      <td class="pos">${e.currentPosition}</td>
                      <td class="stats">${i.getHitterGameStatsShort(e)}</td>

                    </tr>
                  `)}

                </tbody>
              </table>

            </div>
          </div>

        </div>
      </div>

    </div>


    <div class="bottom-bar">

      <div class="matchup">

        <div class="matchup-detail away" style="background-color: ${p}; color: ${f};">

          ${s.awayPlayer?c`
            ${a?c`
              <span class="icon">
                <img src="${a(s.awayPlayer)}" />
              </span>
            `:c``}

            <div class="label">${s.awayPlayer._id===s.pitcher?._id?"Pitching":"At Bat"}</div>

            <div class="player">
              ${n?c`
                <a href="${n(s.awayPlayer)}" style="color: inherit;">${s.awayPlayer.displayName??s.awayPlayer.fullName}</a>
              `:c`
                ${s.awayPlayer.displayName??s.awayPlayer.fullName}
              `}
            </div>

            <div class="game-stats">
              ${s.awayPlayer._id===s.pitcher?._id?i.getPitcherGameStats(s.awayPlayer):i.getHitterGameStats(s.awayPlayer)}
            </div>
          `:c``}

        </div>


        <div class="matchup-detail" style="background-color: ${m}; color: ${$};">

          ${s.homePlayer?c`
            ${a?c`
              <span class="icon">
                <img src="${a(s.homePlayer)}" />
              </span>
            `:c``}

            <div class="label">${s.homePlayer._id===s.pitcher?._id?"Pitching":"At Bat"}</div>

            <div class="player">
              ${n?c`
                <a href="${n(s.homePlayer)}" style="color: inherit;">${s.homePlayer.displayName??s.homePlayer.fullName}</a>
              `:c`
                ${s.homePlayer.displayName??s.homePlayer.fullName}
              `}
            </div>

            <div class="game-stats">
              ${s.homePlayer._id===s.pitcher?._id?i.getPitcherGameStats(s.homePlayer):i.getHitterGameStats(s.homePlayer)}
            </div>
          `:c``}

        </div>

      </div>


      <div class="page-content messages-content">
        <div class="messages messages-init game-messages"></div>
      </div>

      <a href="#" class="messages-action button button-fill popover-open" data-popover=".popover-game-info">
        <i class="f7-icons">info</i>
      </a>

      <div class="popover popover-game-info">
        <div class="popover-angle"></div>
        <div class="popover-inner">
          <div class="list inset list-strong list-dividers-ios">
            <ul>
              <li>
                ${!0===e.paused?c`
                  <a href="#" class="list-button popover-close" @click=${I}>Resume</a>
                `:c`
                  <a href="#" class="list-button popover-close" @click=${R}>Pause</a>
                `}
              </li>
              ${!0===e.paused?c`
                <li>
                  <a href="#" class="list-button popover-close" @click=${P}>Next Pitch</a>
                </li>
              `:c` `}
              <li>
                <a href="#" class="list-button popover-close" @click=${T}>Sim to End</a>
              </li>
              ${o?c`
                <li>
                  <a href="${o(s.game)}" class="list-button popover-close">Box Score</a>
                </li>
              `:c``}
              ${l?c`
                <li>
                  <a href="${l(s.game)}" class="list-button popover-close">Game Log</a>
                </li>
              `:c``}
            </ul>
          </div>
        </div>
      </div>

    </div>

  </div>

`}}K.id="72c2cf5fb7",K.style="\n\n.game-state.top-inning .offense-player .wrapper,\n.game-state.bottom-inning .defense-player .wrapper {\n  border: 2px solid var(--away-color);\n}\n\n.game-state.top-inning .offense-player .text,\n.game-state.bottom-inning .defense-player .text {\n  background: var(--away-color);\n  color: var(--away-font-color);\n}\n\n.game-state.top-inning .offense-player img,\n.game-state.bottom-inning .defense-player img {\n  border-color: var(--away-color);\n}\n\n.game-state.top-inning .defense-player .wrapper,\n.game-state.bottom-inning .offense-player .wrapper {\n  border: 2px solid var(--home-color);\n}\n\n.game-state.top-inning .defense-player .text,\n.game-state.bottom-inning .offense-player .text {\n  background: var(--home-color);\n  color: var(--home-font-color);\n}\n\n.game-state.top-inning .defense-player img,\n.game-state.bottom-inning .offense-player img {\n  border-color: var(--home-color);\n}\n\n.game-state .offense-player .text,\n.game-state .defense-player .text {\n  text-decoration: none;\n}\n\n";const q=K;function V(e){let t=e.vm,s=e.substitutions??[],i=e.boxscoreservice,r=e.getplayerimageurl,a=e.getplayerhref;const n=i.getBoxscoreInfo(s,t),o=e=>e.map(e=>`${e.name}${e.value>1?` ${e.value}`:""}`).join("; ");return function(e){e.$;var s=e.$h;return e.$root,e.$f7,e.$f7route,e.$f7router,e.$theme,e.$update,e.$store,s`

  <div class="block block-outline block-strong">

    <div class="block-header">
      ${t.team.name??t.team.abbrev}
    </div>

    <div class="stat-table-wrapper">
      <table class="data-table small-font game-table">

        <thead>
          <tr>
            <th class="image"></th>
            <th class="name">Batting</th>
            <th class="numeric-cell">POS</th>
            <th class="numeric-cell">AB</th>
            <th class="numeric-cell">R</th>
            <th class="numeric-cell">H</th>
            <th class="numeric-cell">2B</th>
            <th class="numeric-cell">3B</th>
            <th class="numeric-cell">HR</th>
            <th class="numeric-cell">RBI</th>
            <th class="numeric-cell">BB</th>
            <th class="numeric-cell">HBP</th>
            <th class="numeric-cell">SO</th>
          </tr>
        </thead>

        <tbody>

          ${n.batters.map(e=>{return s`
            <tr class="${i=e.player,t.isComplete||t.team.lineupIds[t.team.currentHitterIndex]!==i._id?"":t.isTopInning&&"AWAY"===t.side||!t.isTopInning&&"HOME"===t.side?"at-bat":"at-bat-next"}">

              <td class="image">
                ${r?s`
                  <img src="${r(e.player)}" />
                `:" "}
              </td>

              <td class="name">
                ${e.subNumber?`${e.subNumber}-`:" "}

                ${a?s`
                  <a href="${a(e.player)}">${e.player.fullName}</a>
                `:e.player.fullName}
              </td>

              <td class="pos">${e.player.currentPosition}</td>
              <td class="numeric-cell">${e.player.hitResult.atBats}</td>
              <td class="numeric-cell">${e.player.hitResult.runs}</td>
              <td class="numeric-cell">${e.player.hitResult.hits}</td>
              <td class="numeric-cell">${e.player.hitResult.doubles}</td>
              <td class="numeric-cell">${e.player.hitResult.triples}</td>
              <td class="numeric-cell">${e.player.hitResult.homeRuns}</td>
              <td class="numeric-cell">${e.player.hitResult.rbi}</td>
              <td class="numeric-cell">${e.player.hitResult.bb}</td>
              <td class="numeric-cell">${e.player.hitResult.hbp}</td>
              <td class="numeric-cell">${e.player.hitResult.so}</td>

            </tr>
          `;var i})}

        </tbody>

      </table>
    </div>


    <div class="stat-table-wrapper">
      <table class="data-table small-font game-table">

        <thead>
          <tr>
            <th class="image"></th>
            <th class="name">Pitching</th>
            <th class="numeric-cell">POS</th>
            <th class="numeric-cell">W</th>
            <th class="numeric-cell">L</th>
            <th class="numeric-cell">IP</th>
            <th class="numeric-cell">H</th>
            <th class="numeric-cell">R</th>
            <th class="numeric-cell">ER</th>
            <th class="numeric-cell">HR</th>
            <th class="numeric-cell">BB</th>
            <th class="numeric-cell">SO</th>
            <th class="numeric-cell">HBP</th>
            <th class="numeric-cell">BF</th>
            <th class="numeric-cell">PIT</th>
            <th class="numeric-cell">STR</th>
          </tr>
        </thead>

        <tbody>

          ${n.pitchers.map(e=>{return s`
            <tr class="${i=e.player,t.isComplete||t.team.currentPitcherId!==i._id?"":t.isTopInning&&"HOME"===t.side||!t.isTopInning&&"AWAY"===t.side?"pitching":""}">

              <td class="image">
                ${r?s`
                  <img src="${r(e.player)}" />
                `:" "}
              </td>

              <td class="name">
                ${e.subNumber?`${e.subNumber}-`:" "}

                ${a?s`
                  <a href="${a(e.player)}">${e.player.fullName}</a>
                `:e.player.fullName}
              </td>

              <td class="pos">${e.player.currentPosition}</td>
              <td class="numeric-cell">${e.player.pitchResult.wins}</td>
              <td class="numeric-cell">${e.player.pitchResult.losses}</td>
              <td class="numeric-cell">${e.player.pitchResult.ip}</td>
              <td class="numeric-cell">${e.player.pitchResult.hits}</td>
              <td class="numeric-cell">${e.player.pitchResult.runs}</td>
              <td class="numeric-cell">${e.player.pitchResult.er}</td>
              <td class="numeric-cell">${e.player.pitchResult.homeRuns}</td>
              <td class="numeric-cell">${e.player.pitchResult.bb}</td>
              <td class="numeric-cell">${e.player.pitchResult.so}</td>
              <td class="numeric-cell">${e.player.pitchResult.hbp}</td>
              <td class="numeric-cell">${e.player.pitchResult.battersFaced}</td>
              <td class="numeric-cell">${e.player.pitchResult.pitches}</td>
              <td class="numeric-cell">${e.player.pitchResult.strikes}</td>

            </tr>
          `;var i})}

        </tbody>

      </table>
    </div>


    <div class="batter-summary">

      ${n.doubles.length>0?s`
        <strong>2B:</strong> ${o(n.doubles)}<br />
      `:" "}

      ${n.triples.length>0?s`
        <strong>3B:</strong> ${o(n.triples)}<br />
      `:" "}

      ${n.homeRuns.length>0?s`
        <strong>HR:</strong> ${o(n.homeRuns)}<br />
      `:" "}

      ${n.totalBases.length>0?s`
        <strong>TB:</strong> ${o(n.totalBases)}<br />
      `:" "}

      ${n.rbi.length>0?s`
        <strong>RBI:</strong> ${o(n.rbi)}<br />
      `:" "}

    </div>

  </div>

`}}V.id="b72a936efa",V.style="\n\n\n";const z=V,Z=new x;function Q(e,{$onMounted:t,$onUpdated:s,$onBeforeUnmount:i,$:r,$f7:a,$update:n}){let o,l=e.gamewebservice,c=e.gameviewservice,h=e.gamemessageservice,d=e.game,u=e.fieldimageurl,p=e.getplayerimageurl,m=e.getplayerhref,g=e.getboxscorehref,f=e.getgameloghref,$=!0===e.paused,v=e.advancecallback,y=e.pausecallback,b=e.resumecallback,P=e.simtoendcallback,R=e.registerpageafterincallback,I=d?l.getGameViewModel(d):void 0,T=0,S=Promise.resolve(),E=[".at-bat-ended"],w=d;const B=()=>{if(!d)return void(I=void 0);const e=l.getGameViewModel(d);I?Object.assign(I,e):I=e},x=()=>{for(const e of E)r(e).hide()},N=()=>{o&&o.scroll(0)},D=async e=>{if(!d)return;const t=l.getCurrentDescriptions(d),s=(e=>c.getMessagesFromPlayDescriptions(e))(t);((e,t)=>{if("ENDED"===e){const e=t.find(e=>"RESULT"===e.type)?.text??"";return r(".at-bat-ended .result").text(e),void(e=>{for(const t of E)t!==e&&r(t).hide();r(e).css("display","flex")})(".at-bat-ended")}x()})(l.getAtBatState(d),t),await(async(e,t)=>{if(!o)return;const s=o.messages??[],i=h.getSync(s,e);T++;const r=T;S=S.then(async()=>{if(r===T)if(i.clear&&o.clear(),t)for(const e of i.messages){if(r!==T)return;if(o.showTyping(),await _(500),r!==T)return;o.addMessage(e),o.hideTyping()}else o.addMessages(i.messages)}),await S,N()})(s,e)},_=e=>new Promise(t=>setTimeout(t,e));return t(async()=>{d&&(B(),await n(),o=(()=>{const e=a.messages?.get(".game-messages");return e||a.messages?.create({el:".game-messages",scrollMessages:!0,scrollMessagesOnEdge:!0})})(),R&&R(N),await D(!1))}),s(async()=>{await(async()=>{$=!0===e.paused,v=e.advancecallback,y=e.pausecallback,b=e.resumecallback,P=e.simtoendcallback,R=e.registerpageafterincallback,e.game!==w&&(d=e.game,w=e.game,B(),await D(!1))})()}),i(()=>{T++,R&&R(void 0),x()}),function(e){e.$;var t=e.$h;return e.$root,e.$f7,e.$f7route,e.$f7router,e.$theme,e.$update,e.$store,t`

  <div class="game-page">

    ${I?.game?t`

      <${q}
        vm=${I}
        gameviewservice=${c}
        fieldimageurl=${u}
        getplayerimageurl=${p}
        getplayerhref=${m}
        getboxscorehref=${g}
        getgameloghref=${f}
        paused=${$}
        advancecallback=${v}
        pausecallback=${y}
        resumecallback=${b}
        simtoendcallback=${P}
      />

      <div class="popup box-score-popup popup-tablet-fullscreen">
        <div class="view">
          <div class="page">
            <div class="navbar">
              <div class="navbar-bg"></div>
              <div class="navbar-inner">
                <div class="title">Box Score</div>
                <div class="right">
                  <a class="link popup-close">Close</a>
                </div>
              </div>
            </div>

            <div class="page-content">
              <div class="game-banner">
                <div class="linescore-wrapper">
                  <${W}
                    vm=${I.linescore}
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 large-grid-cols-2">
                <${z}
                  substitutions=${I.game.substitutions??[]}
                  vm=${I.awayBoxscore}
                  boxscoreservice=${Z}
                  getplayerimageurl=${p}
                  getplayerhref=${m}
                />

                <${z}
                  substitutions=${I.game.substitutions??[]}
                  vm=${I.homeBoxscore}
                  boxscoreservice=${Z}
                  getplayerimageurl=${p}
                  getplayerhref=${m}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

    `:t`
      <div class="block">No game found.</div>
    `}

  </div>

`}}Q.id="2e8f83b9eb",Q.style="\n\n\n";const X=Q,J=new E,ee=new w(J),te=new B(J),se=new N,ie=new x,re=new G;export{R as AtBatState,z as BoxscoreComponent,x as BoxscoreService,X as GameInProgressComponent,j as GameLogComponent,N as GameMessageService,U as GamePlaybackService,q as GameStateComponent,B as GameViewService,w as GameWebService,W as LineScoreComponent,E as PlayByPlayService,P as PlayDescriptionType,G as TeamComponentService,ie as boxscoreService,se as gameMessageService,te as gameViewService,ee as gameWebService,J as playByPlayService,re as teamComponentService};