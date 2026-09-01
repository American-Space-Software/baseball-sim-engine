var e,t,i,s,a,r,n,o,l,c,h,d,u,p,m,g,f,$,v,y,b,R,P,I={31:function(e,t,i){var s;!function(e,a){function r(e){var t=this,i="";t.next=function(){var e=t.x^t.x>>>2;return t.x=t.y,t.y=t.z,t.z=t.w,t.w=t.v,(t.d=t.d+362437|0)+(t.v=t.v^t.v<<4^e^e<<1)|0},t.x=0,t.y=0,t.z=0,t.w=0,t.v=0,e===(0|e)?t.x=e:i+=e;for(var s=0;s<i.length+64;s++)t.x^=0|i.charCodeAt(s),s==i.length&&(t.d=t.x<<10^t.x>>>4),t.next()}function n(e,t){return t.x=e.x,t.y=e.y,t.z=e.z,t.w=e.w,t.v=e.v,t.d=e.d,t}function o(e,t){var i=new r(e),s=t&&t.state,a=function(){return(i.next()>>>0)/4294967296};return a.double=function(){do{var e=((i.next()>>>11)+(i.next()>>>0)/4294967296)/(1<<21)}while(0===e);return e},a.int32=i.next,a.quick=a,s&&("object"==typeof s&&n(s,i),a.state=function(){return n(i,{})}),a}a&&a.exports?a.exports=o:i.amdD&&i.amdO?void 0===(s=function(){return o}.call(t,i,t,a))||(a.exports=s):this.xorwow=o}(0,e=i.nmd(e),i.amdD)},67:function(e,t,i){var s;!function(e,a){function r(e){var t=this;t.next=function(){var e,i,s=t.x,a=t.i;return e=s[a],i=(e^=e>>>7)^e<<24,i^=(e=s[a+1&7])^e>>>10,i^=(e=s[a+3&7])^e>>>3,i^=(e=s[a+4&7])^e<<7,e=s[a+7&7],i^=(e^=e<<13)^e<<9,s[a]=i,t.i=a+1&7,i},function(e,t){var i,s=[];if(t===(0|t))s[0]=t;else for(t=""+t,i=0;i<t.length;++i)s[7&i]=s[7&i]<<15^t.charCodeAt(i)+s[i+1&7]<<13;for(;s.length<8;)s.push(0);for(i=0;i<8&&0===s[i];++i);for(8==i?s[7]=-1:s[i],e.x=s,e.i=0,i=256;i>0;--i)e.next()}(t,e)}function n(e,t){return t.x=e.x.slice(),t.i=e.i,t}function o(e,t){null==e&&(e=+new Date);var i=new r(e),s=t&&t.state,a=function(){return(i.next()>>>0)/4294967296};return a.double=function(){do{var e=((i.next()>>>11)+(i.next()>>>0)/4294967296)/(1<<21)}while(0===e);return e},a.int32=i.next,a.quick=a,s&&(s.x&&n(s,i),a.state=function(){return n(i,{})}),a}a&&a.exports?a.exports=o:i.amdD&&i.amdO?void 0===(s=function(){return o}.call(t,i,t,a))||(a.exports=s):this.xorshift7=o}(0,e=i.nmd(e),i.amdD)},180:function(e,t,i){var s;!function(e,a){function r(e){var t,i=this,s=(t=4022871197,function(e){e=String(e);for(var i=0;i<e.length;i++){var s=.02519603282416938*(t+=e.charCodeAt(i));s-=t=s>>>0,t=(s*=t)>>>0,t+=4294967296*(s-=t)}return 2.3283064365386963e-10*(t>>>0)});i.next=function(){var e=2091639*i.s0+2.3283064365386963e-10*i.c;return i.s0=i.s1,i.s1=i.s2,i.s2=e-(i.c=0|e)},i.c=1,i.s0=s(" "),i.s1=s(" "),i.s2=s(" "),i.s0-=s(e),i.s0<0&&(i.s0+=1),i.s1-=s(e),i.s1<0&&(i.s1+=1),i.s2-=s(e),i.s2<0&&(i.s2+=1),s=null}function n(e,t){return t.c=e.c,t.s0=e.s0,t.s1=e.s1,t.s2=e.s2,t}function o(e,t){var i=new r(e),s=t&&t.state,a=i.next;return a.int32=function(){return 4294967296*i.next()|0},a.double=function(){return a()+11102230246251565e-32*(2097152*a()|0)},a.quick=a,s&&("object"==typeof s&&n(s,i),a.state=function(){return n(i,{})}),a}a&&a.exports?a.exports=o:i.amdD&&i.amdO?void 0===(s=function(){return o}.call(t,i,t,a))||(a.exports=s):this.alea=o}(0,e=i.nmd(e),i.amdD)},181:function(e,t,i){var s;!function(e,a){function r(e){var t=this,i="";t.x=0,t.y=0,t.z=0,t.w=0,t.next=function(){var e=t.x^t.x<<11;return t.x=t.y,t.y=t.z,t.z=t.w,t.w^=t.w>>>19^e^e>>>8},e===(0|e)?t.x=e:i+=e;for(var s=0;s<i.length+64;s++)t.x^=0|i.charCodeAt(s),t.next()}function n(e,t){return t.x=e.x,t.y=e.y,t.z=e.z,t.w=e.w,t}function o(e,t){var i=new r(e),s=t&&t.state,a=function(){return(i.next()>>>0)/4294967296};return a.double=function(){do{var e=((i.next()>>>11)+(i.next()>>>0)/4294967296)/(1<<21)}while(0===e);return e},a.int32=i.next,a.quick=a,s&&("object"==typeof s&&n(s,i),a.state=function(){return n(i,{})}),a}a&&a.exports?a.exports=o:i.amdD&&i.amdO?void 0===(s=function(){return o}.call(t,i,t,a))||(a.exports=s):this.xor128=o}(0,e=i.nmd(e),i.amdD)},234:()=>{},391:(e,t,i)=>{var s=i(180),a=i(181),r=i(31),n=i(67),o=i(833),l=i(717),c=i(801);c.alea=s,c.xor128=a,c.xorwow=r,c.xorshift7=n,c.xor4096=o,c.tychei=l,e.exports=c},717:function(e,t,i){var s;!function(e,a){function r(e){var t=this,i="";t.next=function(){var e=t.b,i=t.c,s=t.d,a=t.a;return e=e<<25^e>>>7^i,i=i-s|0,s=s<<24^s>>>8^a,a=a-e|0,t.b=e=e<<20^e>>>12^i,t.c=i=i-s|0,t.d=s<<16^i>>>16^a,t.a=a-e|0},t.a=0,t.b=0,t.c=-1640531527,t.d=1367130551,e===Math.floor(e)?(t.a=e/4294967296|0,t.b=0|e):i+=e;for(var s=0;s<i.length+20;s++)t.b^=0|i.charCodeAt(s),t.next()}function n(e,t){return t.a=e.a,t.b=e.b,t.c=e.c,t.d=e.d,t}function o(e,t){var i=new r(e),s=t&&t.state,a=function(){return(i.next()>>>0)/4294967296};return a.double=function(){do{var e=((i.next()>>>11)+(i.next()>>>0)/4294967296)/(1<<21)}while(0===e);return e},a.int32=i.next,a.quick=a,s&&("object"==typeof s&&n(s,i),a.state=function(){return n(i,{})}),a}a&&a.exports?a.exports=o:i.amdD&&i.amdO?void 0===(s=function(){return o}.call(t,i,t,a))||(a.exports=s):this.tychei=o}(0,e=i.nmd(e),i.amdD)},801:function(e,t,i){var s;!function(a,r,n){var o,l=256,c=n.pow(l,6),h=n.pow(2,52),d=2*h,u=255;function p(e,t,i){var s=[],u=$(f((t=1==t?{entropy:!0}:t||{}).entropy?[e,v(r)]:null==e?function(){try{var e;return o&&(e=o.randomBytes)?e=e(l):(e=new Uint8Array(l),(a.crypto||a.msCrypto).getRandomValues(e)),v(e)}catch(e){var t=a.navigator,i=t&&t.plugins;return[+new Date,a,i,a.screen,v(r)]}}():e,3),s),p=new m(s),y=function(){for(var e=p.g(6),t=c,i=0;e<h;)e=(e+i)*l,t*=l,i=p.g(1);for(;e>=d;)e/=2,t/=2,i>>>=1;return(e+i)/t};return y.int32=function(){return 0|p.g(4)},y.quick=function(){return p.g(4)/4294967296},y.double=y,$(v(p.S),r),(t.pass||i||function(e,t,i,s){return s&&(s.S&&g(s,p),e.state=function(){return g(p,{})}),i?(n.random=e,t):e})(y,u,"global"in t?t.global:this==n,t.state)}function m(e){var t,i=e.length,s=this,a=0,r=s.i=s.j=0,n=s.S=[];for(i||(e=[i++]);a<l;)n[a]=a++;for(a=0;a<l;a++)n[a]=n[r=u&r+e[a%i]+(t=n[a])],n[r]=t;(s.g=function(e){for(var t,i=0,a=s.i,r=s.j,n=s.S;e--;)t=n[a=u&a+1],i=i*l+n[u&(n[a]=n[r=u&r+t])+(n[r]=t)];return s.i=a,s.j=r,i})(l)}function g(e,t){return t.i=e.i,t.j=e.j,t.S=e.S.slice(),t}function f(e,t){var i,s=[],a=typeof e;if(t&&"object"==a)for(i in e)try{s.push(f(e[i],t-1))}catch(e){}return s.length?s:"string"==a?e:e+"\0"}function $(e,t){for(var i,s=e+"",a=0;a<s.length;)t[u&a]=u&(i^=19*t[u&a])+s.charCodeAt(a++);return v(t)}function v(e){return String.fromCharCode.apply(0,e)}if($(n.random(),r),e.exports){e.exports=p;try{o=i(234)}catch(e){}}else void 0===(s=function(){return p}.call(t,i,t,e))||(e.exports=s)}("undefined"!=typeof self?self:this,[],Math)},833:function(e,t,i){var s;!function(e,a){function r(e){var t=this;t.next=function(){var e,i,s=t.w,a=t.X,r=t.i;return t.w=s=s+1640531527|0,i=a[r+34&127],e=a[r=r+1&127],i^=i<<13,e^=e<<17,i^=i>>>15,e^=e>>>12,i=a[r]=i^e,t.i=r,i+(s^s>>>16)|0},function(e,t){var i,s,a,r,n,o=[],l=128;for(t===(0|t)?(s=t,t=null):(t+="\0",s=0,l=Math.max(l,t.length)),a=0,r=-32;r<l;++r)t&&(s^=t.charCodeAt((r+32)%t.length)),0===r&&(n=s),s^=s<<10,s^=s>>>15,s^=s<<4,s^=s>>>13,r>=0&&(n=n+1640531527|0,a=0==(i=o[127&r]^=s+n)?a+1:0);for(a>=128&&(o[127&(t&&t.length||0)]=-1),a=127,r=512;r>0;--r)s=o[a+34&127],i=o[a=a+1&127],s^=s<<13,i^=i<<17,s^=s>>>15,i^=i>>>12,o[a]=s^i;e.w=n,e.X=o,e.i=a}(t,e)}function n(e,t){return t.i=e.i,t.w=e.w,t.X=e.X.slice(),t}function o(e,t){null==e&&(e=+new Date);var i=new r(e),s=t&&t.state,a=function(){return(i.next()>>>0)/4294967296};return a.double=function(){do{var e=((i.next()>>>11)+(i.next()>>>0)/4294967296)/(1<<21)}while(0===e);return e},a.int32=i.next,a.quick=a,s&&(s.X&&n(s,i),a.state=function(){return n(i,{})}),a}a&&a.exports?a.exports=o:i.amdD&&i.amdO?void 0===(s=function(){return o}.call(t,i,t,a))||(a.exports=s):this.xor4096=o}(0,e=i.nmd(e),i.amdD)}},S={};function w(e){var t=S[e];if(void 0!==t)return t.exports;var i=S[e]={id:e,loaded:!1,exports:{}};return I[e].call(i.exports,i,i.exports,w),i.loaded=!0,i.exports}w.amdD=function(){throw new Error("define cannot be used indirect")},w.amdO={},w.n=e=>{var t=e&&e.__esModule?()=>e.default:()=>e;return w.d(t,{a:t}),t},w.d=(e,t)=>{for(var i in t)w.o(t,i)&&!w.o(e,i)&&Object.defineProperty(e,i,{enumerable:!0,get:t[i]})},w.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),w.nmd=e=>(e.paths=[],e.children||(e.children=[]),e),function(e){e.ERROR="ERROR",e.STRIKEOUT="STRIKEOUT",e.OUT="OUT",e.HIT_BY_PITCH="HIT_BY_PITCH",e.BB="BB",e.SINGLE="SINGLE",e.DOUBLE="DOUBLE",e.TRIPLE="TRIPLE",e.HR="HR"}(e||(e={})),function(e){e.GROUNDBALL="GROUNDBALL",e.LINE_DRIVE="LINE_DRIVE",e.FLY_BALL="FLY_BALL"}(t||(t={})),function(e){e.SHALLOW="SHALLOW",e.NORMAL="NORMAL",e.DEEP="DEEP"}(i||(i={})),function(e){e.LOW_AWAY="LOW_AWAY",e.LOW_MIDDLE="LOW_MIDDLE",e.LOW_INSIDE="LOW_INSIDE",e.MID_AWAY="MID_AWAY",e.MID_MIDDLE="MID_MIDDLE",e.MID_INSIDE="MID_INSIDE",e.HIGH_AWAY="HIGH_AWAY",e.HIGH_MIDDLE="HIGH_MIDDLE",e.HIGH_INSIDE="HIGH_INSIDE"}(s||(s={})),function(e){e.BALL="BALL",e.STRIKE="STRIKE",e.FOUL="FOUL",e.IN_PLAY="IN_PLAY",e.HBP="HIT_BY_PITCH"}(a||(a={})),function(e){e.FF="FF",e.CU="CU",e.CH="CH",e.FC="FC",e.FO="FO",e.KN="KN",e.KC="KC",e.SC="SC",e.SI="SI",e.SL="SL",e.SV="SV",e.FS="FS",e.ST="ST"}(r||(r={})),function(e){e.FIRST="1B",e.SECOND="2B",e.THIRD="3B",e.HOME="home"}(n||(n={})),function(e){e.L="L",e.R="R",e.S="S"}(o||(o={})),function(e){e.CATCHER="C",e.PITCHER="P",e.FIRST_BASE="1B",e.SECOND_BASE="2B",e.THIRD_BASE="3B",e.SHORTSTOP="SS",e.LEFT_FIELD="LF",e.CENTER_FIELD="CF",e.RIGHT_FIELD="RF",e.DESIGNATED_HITTER="DH"}(l||(l={})),function(e){e.INTENT_WALK="Intent Walk",e.HIT_BY_PITCH="Hit By Pitch",e.SAC_FLY="Sac Fly",e.SAC_FLY_DP="Sac Fly DP",e.WALK="Walk",e.CATCHER_INTERFERENCE="Catcher Interference",e.RUNNER_OUT="Runner Out",e.EJECTION="Ejection",e.SINGLE="Single",e.DOUBLE="Double",e.TRIPLE="Triple",e.HOME_RUN="Home Run",e.STRIKEOUT="Strikeout",e.STRIKEOUT_DP="Strikeout - DP",e.SAC_BUNT="Sac Bunt",e.SAC_BUNT_DP="Sacrifice Bunt DP",e.BATTER_INTERFERENCE="Batter Interference",e.BUNT_GROUNDOUT="Bunt Groundout",e.BUNT_LINEOUT="Bunt Lineout",e.BUNT_POPOUT="Bunt Pop Out",e.FAN_INTERFERENCE="Fan Interference",e.FIELDERS_CHOICE="Fielders Choice",e.FLYOUT="Flyout",e.POP_OUT="Pop Out",e.FOURCEOUT="Forceout",e.GROUNDOUT="Groundout",e.GROUNDED_INTO_DP="Grounded Into DP",e.TRIPLE_PLAY="Triple Play",e.REACHED_ON_ERROR="Reached on Error"}(c||(c={})),function(e){e.TAGGED_OUT="Tagged out",e.FORCE_OUT="Force out",e.HOME_TO_FIRST="Advanced from home to 1B",e.HOME_TO_SECOND="Advanced from home to 2B",e.HOME_TO_THIRD="Advanced from home to 3B",e.HOME_TO_SCORE="Advanced from home to come around and score",e.FIRST_TO_SECOND="Advanced from 1B to 2B",e.FIRST_TO_THIRD="Advanced from 1B to 3B",e.FIRST_TO_HOME="Advanced from 1B to home",e.SECOND_TO_THIRD="Advanced from 2B to 3B",e.SECOND_TO_HOME="Advanced from 2B to home",e.THIRD_TO_HOME="Advanced from 3B to home",e.TAGGED_FIRST_TO_SECOND="Tagged up and moved from 1B to 2B",e.TAGGED_SECOND_TO_THIRD="Tagged up and moved from 2B to 3B",e.TAGGED_THIRD_TO_HOME="Tagged up and scored from 3B.",e.STOLEN_BASE_2B="Stolen Base 2B",e.STOLEN_BASE_3B="Stolen Base 3B",e.STOLEN_BASE_HOME="Stolen Base Home",e.CAUGHT_STEALING_2B="Caught Stealing 2B",e.CAUGHT_STEALING_3B="Caught Stealing 3B",e.CAUGHT_STEALING_HOME="Caught Stealing Home"}(h||(h={})),function(e){e.ASSIST="ASSIST",e.ERROR="ERROR",e.PUTOUT="PUTOUT",e.CAUGHT_STEALING="CAUGHT_STEALING",e.PASSED_BALL="PASSED_BALL"}(d||(d={})),function(e){e.SAFE="safe",e.OUT="out",e.NO_THROW="no throw"}(u||(u={})),function(e){e.FAIR="FAIR",e.FOUL="FOUL",e.STRIKE="STRIKE",e.NO_SWING="NO_SWING"}(p||(p={})),function(e){e.HOME="Home",e.AWAY="Away"}(m||(m={})),function(e){e.CONTACT="CONTACT",e.MISS="MISS"}(g||(g={})),function(e){e.STARTER="starter",e.CLOSER="closer",e.SETUP="setup",e.MIDDLE="middle",e.LONG="long",e.MOP_UP="mop_up"}(f||(f={})),function(e){e.SWING="swing",e.TAKE="take"}($||($={})),function(e){e.FAIR="FAIR",e.FOUL="FOUL"}(v||(v={})),function(e){e.OUT="OUT",e.SINGLE="SINGLE"}(y||(y={})),function(e){e.HIT="HIT",e.OUT="OUT"}(b||(b={}));class T{getPlayDescriptions(e,t){const i=[],s=this.getGamePlayers(e),r=s[t.hitterId];let n;i.push(...this.getSubstitutionDescriptions(e,t)),i.push({type:R.RECAP,text:this.getMatchupDescription(t,r)});const o=t.pitchLog?.pitches??[];for(let s=0;s<o.length;s++){const r=o[s];r.result===a.IN_PLAY&&(n=r),i.push({type:R.RECAP,text:this.getPitchDescription(r),meta:{pitch:r}});const l=t.runner?.events?.filter(e=>e.pitchIndex===s)??[];for(const s of l){if(this.isBatterRunnerPrimaryEvent(t,s))continue;const a=this.getRunnerDescription(e,s);a&&i.push({type:R.RECAP,text:a})}}const l=t.fielderId?s[t.fielderId]:void 0;i.push(...this.getPlayResultDescription(t,r,l,n)),i.push(...this.getRunnerRecapDescription(e,t));let c=!1;const h=t.runner?.result?.end?.scored?.length??0;if(h>0&&(i.push({type:R.RECAP,text:1===h?"1 run scores.":`${h} runs score.`}),i.push({type:R.RECAP,text:`The score is ${t.score.end?.away??t.score.start.away} - ${t.score.end?.home??t.score.start.home}.`}),c=!0),(t.runner?.result?.end?.out?.length??0)>0){const s=t.count.end?.outs??0;if(3===s)if(i.push({type:R.RECAP,text:"There's 3 outs and the inning is complete."}),this.isGameEndingPlay(e,t))i.push(...this.getGameRecapDescriptions(e,t));else{const e=t.inningTop?"top":"bottom",s=t.score.end?.away??t.score.start.away,a=t.score.end?.home??t.score.start.home,r=c?`End of the ${e} of the ${this.ordinal(t.inningNum)}. It's ${s} - ${a}.`:`We'll switch sides. The score is ${s} - ${a}.`;i.push({type:R.RECAP,text:r})}else i.push({type:R.RECAP,text:`There ${this.getOutsPhrase(s)}.`})}return i}getPlayByPlay(e){const t=[];for(const i of[...e.halfInnings??[]].reverse())for(const s of[...i.plays].reverse())t.push({descriptions:this.getPlayDescriptions(e,s),play:s});return t}getGameStartDescriptions(e){const t=this.getGamePlayers(e),i=e.away.currentPitcherId?t[e.away.currentPitcherId]:void 0,s=e.home.currentPitcherId?t[e.home.currentPitcherId]:void 0,a=this.getTeamName(e.away),r=this.getTeamName(e.home),n=[{type:R.RECAP,text:`${a} at ${r}.`}];return i&&n.push({type:R.RECAP,text:`${i.fullName} gets the start for ${a}.`}),s&&n.push({type:R.RECAP,text:`${s.fullName} gets the start for ${r}.`}),n}getInningStartDescriptions(e){const t=1009*(e.index??0)+3*this.hash(String(e.inningNum??""))+(e.inningTop?7:11)+13*this.hash(`${e.score.start.away}-${e.score.start.home}`)+17*this.hash(JSON.stringify(e.runner?.result?.start??{}))+19*this.hash(String(e.count.start.outs??0)),i=e.inningTop?"top":"bottom",s=e.score.start.away,a=e.score.start.home,r=s===a?`It's tied ${s}-${a}`:s>a?`The visitors lead ${s}-${a}`:`The home team leads ${a}-${s}`,n=e.count.start.outs,o=0===n?"no outs":1===n?"one out":2===n?"two outs":`${n} outs`,l=1===n?`There's ${o}`:`There are ${o}`,c=this.getRunnersPhrase(e.runner.result.start),h=this.ordinal(e.inningNum),d=[()=>`We move to the ${i} of the ${h}. ${r}. ${l} and ${c}.`,()=>`Now in the ${i} of the ${h}. ${r}. ${l} with ${c}.`,()=>`To the ${i} of the ${h} we go. ${r}. ${l}; ${c}.`,()=>`Here in the ${i} of the ${h}. ${r}. ${l} and ${c}.`,()=>`${i[0].toUpperCase()+i.slice(1)} ${h}. ${r}. ${l} and ${c}.`];return[{type:R.RECAP,text:this.pick(d,t)()}]}getGameRecapDescriptions(e,t){const i=this.getTeamName(e.away),s=this.getTeamName(e.home),a=t.score.end?.away??t.score.start.away,r=t.score.end?.home??t.score.start.home,n=a===r?null:a>r?i:s,o=1009*(t.index??0)+3*this.hash(String(e._id??""))+7*this.hash(String(t.inningNum??""))+(t.inningTop?11:13)+17*this.hash(`${a}-${r}`),l=n?[()=>`${n} win it.`,()=>`${n} come away with the win.`,()=>`${n} take this one.`,()=>`Final: ${n} on top.`]:[()=>"This one ends in a tie.",()=>"They finish even.",()=>"All square at the end."],c=Math.abs(a-r),h=a===r?[]:1===c?[()=>"A one-run game to the end.",()=>"A tight one-run finish."]:c>=6?[()=>"A comfortable win in the end.",()=>"They pull away for the win."]:[()=>"A solid win in the end.",()=>"They get it done today."],d=[{type:R.RECAP,text:this.pick([()=>"That's the ballgame.",()=>"And this one is over.",()=>"Ballgame."],o)()},{type:R.RECAP,text:this.pick(l,o+23)()}];return h.length>0&&d.push({type:R.RECAP,text:this.pick(h,o+41)()}),d.push({type:R.RECAP,text:`The final score is ${a} - ${r}.`}),d}getPlayResultDescription(i,s,a,r){const o=[],h=1009*(i.index??0)+this.hash(String(i.hitterId??""))+3*this.hash(String(i.pitcherId??""))+7*this.hash(String(i.fielderId??""))+11*this.hash(String(i.result??""))+13*this.hash(String(i.officialPlayResult??"")),d=s?.fullName??"The batter",u=a?.fullName??"the fielder",p=i.fielder?this.getPositionDescriptionNoun(i.fielder):"fielder",m=i.fielder?this.getPositionDescription(i.fielder):"field",g=i?.contact?.type??i.contact,f="GROUND_BALL"===g||"GB"===g||"GROUND"===g||0===g||g===t.GROUNDBALL,$="POPUP"===g||"PU"===g||"POP_FLY"===g,v="LINE_DRIVE"===g||"LD"===g||g===t.LINE_DRIVE,y="FLY_BALL"===g||"FB"===g||"FLY"===g||g===t.FLY_BALL,b=this.isToOF(i.fielder),P=()=>this.getContactDescription(i.contact,b,this.isHit(i.result))?.trim()??"",I=()=>$?"blooper":v?"line-drive":f?"ground-ball":y?"fly-ball":this.tidy(P().replace(/^(a|an)\s+/i,"").replace(/\s+ball$/i,"")),S=()=>b?this.tidy(`to the ${this.getShallowDeepDescription(i.shallowDeep)} ${m}`):f?"through the infield":"past the infield",w=i.runner?.events?.find(e=>e.movement?.start===n.FIRST),T=i.runner?.events?.find(e=>e.movement?.start===n.SECOND),E=i.runner?.events?.find(e=>e.movement?.start===n.THIRD),B=E?.movement?.isOut?E:T?.movement?.isOut?T:w?.movement?.isOut?w:void 0,N=B?.movement?.outBase,x=()=>this.getContactDescriptionOut(i.contact,b)??"is retired",D=[()=>`${d} strikes out.`,()=>`${d} goes down on strikes for the strikeout.`,()=>`Strike three. ${d} strikes out.`],_=[()=>`${d} draws a walk.`,()=>`${d} takes ball four for a walk.`,()=>`Ball four. ${d} reaches on a walk.`],A=[()=>`${d} gets hit by a pitch.`,()=>`Hit by pitch. ${d} takes first.`,()=>`${d} is clipped and will head to first base.`],O=[()=>`${d} ${x()} to ${p} ${u}.`,()=>{return`${d} ${x()} to ${u} ${e=i.fielder,e===l.LEFT_FIELD||e===l.CENTER_FIELD||e===l.RIGHT_FIELD?"in":"at"} ${m}.`;var e},()=>`${d} ${x()} and ${u} makes the play.`].map(e=>()=>this.tidy(e())),L=[()=>`${d} chops a ground ball through the infield for a single.`,()=>`${d} bounces a grounder through the right side for a single.`,()=>`${d} hits a grounder that finds a hole for a single.`],C=[()=>`${d} hits a ${I()} single ${S()}.`,()=>`${d} lines a ${I()} single ${S()}.`,()=>`${d} drops a ${I()} single ${S()}.`].map(e=>()=>this.tidy(e())),F=[()=>`${d} hits a ${I()} double ${S()}.`,()=>`${d} drives a ${I()} double ${S()}.`,()=>`${d} rips a ${I()} double ${S()}.`].map(e=>()=>this.tidy(e())),H=[()=>`${d} hits a ${I()} triple ${S()}.`,()=>`${d} drives a ${I()} triple ${S()}.`,()=>`${d} legs out a ${I()} triple ${S()}.`].map(e=>()=>this.tidy(e())),k=[()=>`${d} hits a home run.`,()=>`${d} launches a home run.`,()=>`Home run for ${d}.`],G=[e=>`${d} puts it in play to ${p} ${u}. The lead runner is out at ${e}. Fielder's choice.`,e=>`${d} puts it on the ground to ${p} ${u}. The throw goes to ${e} for the out. Fielder's choice.`,e=>`${d} ${x()} to ${p} ${u}. They get the lead runner at ${e}. Fielder's choice.`].map(e=>t=>this.tidy(e(t))),U=[e=>`${d} ${x()} to ${p} ${u}. Throw to ${e} for one, relay to first for the double play.`,e=>`${d} rolls it to ${p} ${u}. ${e} gets the lead runner, and the relay completes the double play.`,e=>`${d} ${x()} and it's turned. Out at ${e}, and the double play to first.`].map(e=>t=>this.tidy(e(t)));switch(i.result){case e.STRIKEOUT:o.push({type:R.RESULT,text:this.pick(D,h)()});break;case e.BB:o.push({type:R.RESULT,text:this.pick(_,h)()});break;case e.HIT_BY_PITCH:o.push({type:R.RESULT,text:this.pick(A,h)()});break;case e.OUT:i.officialPlayResult===c.FIELDERS_CHOICE&&N?o.push({type:R.RESULT,text:this.pick(G,h)(String(N))}):i.officialPlayResult===c.GROUNDED_INTO_DP&&N?o.push({type:R.RESULT,text:this.pick(U,h)(String(N))}):o.push({type:R.RESULT,text:this.pick(O,h)()});break;case e.SINGLE:o.push({type:R.RESULT,text:this.pick(f?L:C,h)()});break;case e.DOUBLE:o.push({type:R.RESULT,text:this.pick(F,h)()});break;case e.TRIPLE:o.push({type:R.RESULT,text:this.pick(H,h)()});break;case e.HR:o.push({type:R.RESULT,text:this.pick(k,h)()})}for(const e of o)e.text=this.tidy(e.text);return r&&o.length>0&&(o[0].meta={pitch:r}),o}getMatchupDescription(e,t){const i=t?.fullName??"The batter",s=e.count.start.outs,a=0===s?"no outs":1===s?"one out":2===s?"two outs":`${s} outs`;return`That will bring up ${i}. ${1===s?`There's ${a}`:`There are ${a}`} and ${this.getRunnersPhrase(e.runner.result.start)}.`}getPitchDescription(e){const t=this.getPitchTypeFull(e.type).toLowerCase(),i=["Taken for a strike","Called a strike","Strike called"],s=["Taken for a ball","Ball","Just misses"],r=["The batter swings and misses","The batter comes up empty","The batter swings through it"],n=["The batter chases and misses","The batter goes after it and misses","The batter swings at a pitch out of the zone and misses"],o=["The batter fouls it straight back","The batter snaps it foul","Fouled straight back"],l=["The batter puts it in play","The batter swings and puts it in play","Contact made, ball in play"],c=["The batter is hit by the pitch","Hit by pitch"],h=(e.overallQuality??0)+7*(Number(e.type)||0)+13*(e.actualZone?String(e.actualZone).length:0)+(e.locQ?Math.floor(e.locQ):0),d=`${this.pick(["Here comes a","Now a","The pitch is a"],h+3)} ${t} ${e.result===a.BALL?this.describeZoneOffPlate(e.actualZone):this.describeZoneNeutral(e.actualZone)}.`;let u="";if(e.isWP)u=this.pick(["It skips past the catcher for a wild pitch","That one gets away for a wild pitch"],h+7);else if(e.isPB)u=this.pick(["It gets away from the catcher","Passed ball"],h+7);else switch(e.result){case a.IN_PLAY:u=this.pick(l,h+9);break;case a.FOUL:u=this.pick(o,h+9);break;case a.HBP:u=this.pick(c,h+9);break;case a.STRIKE:u=e.swing?this.pick(r,h+11):this.pick(i,h+11);break;case a.BALL:u=e.swing?this.pick(n,h+13):this.pick(s,h+11)}const p=e.result===a.STRIKE&&(e.count?.strikes??0)>=2,m=e.result===a.BALL&&(e.count?.balls??0)>=3;return[d,u?`${u}.`:"",e.count&&!p&&!m&&e.result!==a.IN_PLAY&&e.result!==a.HBP&&e.count?this.pick([e=>`The count is ${e.balls}-${e.strikes}`,e=>`Now ${e.balls}-${e.strikes}`],h+19)({balls:Math.min(e.count.balls??0,3),strikes:Math.min(e.count.strikes??0,2),outs:e.count.outs})+".":""].filter(Boolean).join(" ")}getRunnerRecapDescription(e,t){const i=[],s=t.runner?.events??[],a=t.pitchLog?.pitches?.length??0;for(const r of s){if(this.isBatterRunnerPrimaryEvent(t,r))continue;if("number"==typeof r.pitchIndex&&r.pitchIndex>=0&&r.pitchIndex<a)continue;const s=this.getRunnerDescription(e,r);s&&i.push({type:R.RECAP,text:s})}return i}getRunnerDescription(e,t){const i=this.getGamePlayers(e),s=t.runner?._id?i[t.runner._id]:void 0,a=s?.fullName??"A runner",r=t.throw?.from?._id?i[t.throw.from._id]:void 0,o=t.movement?.outBase??t.movement?.end,l=t.movement?.start,c=t.movement?.end;return t.movement?.isOut?r&&t.throw?.from?.position?t.isSBAttempt?`${a} is caught stealing at ${o} on the throw from the ${this.getPositionDescriptionNoun(t.throw.from.position)} ${r.fullName}.`:`${a} is out at ${o} on the throw from the ${this.getPositionDescriptionNoun(t.throw.from.position)} ${r.fullName}.`:`${a} is out.`:c===n.HOME?`${a} scores from ${l}${t.isError?" [Error]":""}.`:t.isSBAttempt?r&&t.throw?.from?.position?`${a} steals ${c} with a throw from the ${this.getPositionDescriptionNoun(t.throw.from.position)} ${r.fullName}.`:`${a} steals ${c}.`:t.isPB?`${a} moves to ${c} on a passed ball.`:t.isWP?`${a} moves to ${c} on a wild pitch.`:t.eventType===h.TAGGED_FIRST_TO_SECOND||t.eventType===h.TAGGED_SECOND_TO_THIRD||t.eventType===h.TAGGED_THIRD_TO_HOME?`${a} tags up and advances to ${c} from ${l}.`:`${a} advances to ${c}${t.isError?" [Error]":""}.`}getSubstitutionDescriptions(e,t){const i=[],s=(e.substitutions??[]).filter(e=>e.playIndex===t.index).sort((e,t)=>e.isPitchingChange===t.isPitchingChange?0:e.isPitchingChange?1:-1);for(const t of s){const s=this.getGamePlayers(e),a=t.teamId===e.away._id?e.away:e.home,r=this.getTeamName(a),n=s[t.outPlayerId],o=s[t.inPlayerId];if(!o)continue;const l=this.getSubstitutionDescriptionSeed(e,t);let c;if(t.isPitchingChange)c=n?this.pickSubstitutionText([`Pitching change for ${r}. ${o.fullName} takes over for ${n.fullName}.`,`A call to the bullpen for ${r}. ${o.fullName} replaces ${n.fullName}.`,`That's all for ${n.fullName}. ${o.fullName} is the new pitcher for ${r}.`,`A new pitcher for ${r}. ${o.fullName} comes on in relief of ${n.fullName}.`,`${o.fullName} enters for ${r}, replacing ${n.fullName} on the mound.`],l):this.pickSubstitutionText([`Pitching change for ${r}. ${o.fullName} takes over on the mound.`,`A call to the bullpen for ${r}. ${o.fullName} is the new pitcher.`,`A new pitcher for ${r}. ${o.fullName} comes on in relief.`,`${o.fullName} enters to pitch for ${r}.`],l);else if(t.requiresPitcherChange)c=n?this.pickSubstitutionText([`Pinch hitter for ${r}. ${o.fullName} will bat for ${n.fullName}.`,`A move to the bench for ${r}. ${o.fullName} bats in place of ${n.fullName}.`,`${o.fullName} comes off the bench to hit for ${n.fullName}.`,`An offensive change for ${r}. ${o.fullName} will hit for ${n.fullName}.`,`${o.fullName} is announced as a pinch hitter for ${n.fullName}.`],l):this.pickSubstitutionText([`Pinch hitter for ${r}. ${o.fullName} steps in.`,`A move to the bench for ${r}. ${o.fullName} will hit.`,`${o.fullName} comes off the bench as a pinch hitter.`,`An offensive change for ${r}. ${o.fullName} will bat.`],l);else{const e=t.toPosition?this.getPositionDescription(t.toPosition):void 0;c=n?this.getLineupSubstitutionText(r,o.fullName,n.fullName,e,l):this.getLineupSubstitutionTextWithoutOutgoingPlayer(r,o.fullName,e,l)}i.push({type:R.SUBSTITUTION,text:c})}return i}getLineupSubstitutionText(e,t,i,s,a){return s?this.pickSubstitutionText([`Defensive change for ${e}. ${t} takes over at ${s}.`,`A defensive substitution for ${e}. ${t} replaces ${i} at ${s}.`,`${t} enters the game at ${s} for ${e}.`,`A defensive move for ${e}. ${t} is now at ${s}.`,`${t} comes in for ${i} and takes over at ${s}.`],a):this.pickSubstitutionText([`A substitution for ${e}. ${t} replaces ${i}.`,`${t} enters the game for ${e}, replacing ${i}.`,`A new player for ${e}. ${t} replaces ${i}.`],a)}getLineupSubstitutionTextWithoutOutgoingPlayer(e,t,i,s){return i?this.pickSubstitutionText([`Defensive change for ${e}. ${t} takes over at ${i}.`,`A defensive substitution for ${e}. ${t} enters at ${i}.`,`${t} enters the game at ${i} for ${e}.`,`A defensive move for ${e}. ${t} is now at ${i}.`],s):this.pickSubstitutionText([`A substitution for ${e}. ${t} enters the game.`,`${t} enters the game for ${e}.`,`A new player enters for ${e}. ${t} is into the game.`],s)}getSubstitutionDescriptionSeed(e,t){return this.hash([e._id||"",t.teamId||"",t.outPlayerId||"",t.inPlayerId||"",t.playIndex??0,t.lineupIndex??"",t.isPitchingChange?"P":"B"].join("|"))}getRunnersPhrase(e){const{first:t,second:i,third:s}=e;return t&&i&&s?"the bases loaded":t&&i?"runners on first and second":t&&s?"runners on first and third":i&&s?"runners on second and third":t?"a runner on first":i?"a runner on second":s?"a runner on third":"the bases empty"}describeZoneNeutral(e){const[t,i]=String(e).split("_"),s="LOW"===t?"low":"MID"===t?"middle":"high",a="AWAY"===i?"away":"MIDDLE"===i?"over the plate":"inside";return"over the plate"===a?`${s} ${a}`:`${s} and ${a}`}describeZoneOffPlate(e){const[t,i]=String(e).split("_"),s="LOW"===t?"low":"MID"===t?"just off the plate":"high",a="AWAY"===i?"the outside corner":"INSIDE"===i?"the inside corner":"the plate";return"MID"===t&&"MIDDLE"===i?"just off the plate":"MID"===t?`just off ${a}`:"MIDDLE"===i?`${s}, just off the plate`:`${s}, just off ${a}`}getContactDescription(e,i,s){switch(e){case t.FLY_BALL:return i?"a fly ball":"a popup";case t.GROUNDBALL:return s?"a ground ball":"a grounder";case t.LINE_DRIVE:return"a line drive"}}getContactDescriptionOut(e,i){switch(e){case t.FLY_BALL:return i?"flies out":"pops out";case t.GROUNDBALL:return"grounds out";case t.LINE_DRIVE:return"lines out"}}getShallowDeepDescription(e){return e!==i.NORMAL&&e?String(e).toLowerCase():""}getPositionDescription(e){switch(e){case l.PITCHER:return"pitcher";case l.CATCHER:return"catcher";case l.FIRST_BASE:return"first base";case l.SECOND_BASE:return"second base";case l.THIRD_BASE:return"third base";case l.SHORTSTOP:return"shortstop";case l.LEFT_FIELD:return"left field";case l.CENTER_FIELD:return"center field";case l.RIGHT_FIELD:return"right field";default:return String(e)}}getPositionDescriptionNoun(e){switch(e){case l.PITCHER:return"pitcher";case l.CATCHER:return"catcher";case l.FIRST_BASE:return"first baseman";case l.SECOND_BASE:return"second baseman";case l.THIRD_BASE:return"third baseman";case l.SHORTSTOP:return"shortstop";case l.LEFT_FIELD:return"left fielder";case l.CENTER_FIELD:return"center fielder";case l.RIGHT_FIELD:return"right fielder";default:return String(e)}}getPitchTypeFull(e){switch(e){case r.FF:return"Fastball";case r.CU:return"Curveball";case r.CH:return"Changeup";case r.FC:return"Cutter";case r.FO:return"Forkball";case r.KN:return"Knuckleball";case r.KC:return"Knuckle Curve";case r.SC:return"Screwball";case r.SI:return"Sinker";case r.SL:return"Slider";case r.SV:return"Slurve";case r.FS:return"Splitter";case r.ST:return"Slutter";default:return String(e)}}getGamePlayers(e){const t=[...e.away.players??[],...e.home.players??[]],i={};for(const e of t)i[e._id]=e;return i}getTeamName(e){return e.name||e.abbrev||"Team"}isBatterRunnerPrimaryEvent(e,t){return t.runner?._id===e.hitterId&&t.movement?.start===n.HOME}isGameEndingPlay(e,t){return!!e.isFinished&&t.index===e.playIndex}isHit(t){return t===e.SINGLE||t===e.DOUBLE||t===e.TRIPLE||t===e.HR}isToOF(e){return e===l.LEFT_FIELD||e===l.CENTER_FIELD||e===l.RIGHT_FIELD}getOutsPhrase(e){return 1===e?"is one out":`are ${e} outs`}ordinal(e){const t=e%100;if(t>=11&&t<=13)return`${e}th`;switch(e%10){case 1:return`${e}st`;case 2:return`${e}nd`;case 3:return`${e}rd`;default:return`${e}th`}}hash(e){let t=2166136261;for(let i=0;i<e.length;i++)t^=e.charCodeAt(i),t=Math.imul(t,16777619);return t>>>0}pick(e,t){return e[Math.abs(t)%e.length]}pickSubstitutionText(e,t){return this.pick(e,t)}tidy(e){return e.replace(/\s+/g," ").trim()}}!function(e){e.RECAP="RECAP",e.RESULT="RESULT",e.SUBSTITUTION="SUBSTITUTION"}(R||(R={}));class E{playByPlayService;constructor(e){this.playByPlayService=e}getGameViewModel(e){const t=this.getLineScore(e),i={side:"AWAY",team:e.away,isComplete:e.isComplete,isTopInning:e.isTopInning},s={side:"HOME",team:e.home,isComplete:e.isComplete,isTopInning:e.isTopInning},a={game:e,linescore:t,awayBoxscore:i,homeBoxscore:s,atBatBoxscore:e.isTopInning?i:s,isTopInning:e.isTopInning,currentInning:e.currentInning,balls:e.count?.balls??0,strikes:e.count?.strikes??0,outs:e.count?.outs??0,score:e.score,showHitter:!1,showPitcher:!1};if(!e.isStarted)return a;const r=this.getGamePlayers(e),n=this.getOffense(e),o=this.getDefense(e),c=this.getCurrentPlay(e),h=this.getHitter(e,c),d=this.getPitcher(e),u=this.getPlayer(r,n.runner1BId),p=this.getPlayer(r,n.runner2BId),m=this.getPlayer(r,n.runner3BId),g=e.isComplete?this.getPlayer(r,e.winningPitcherId):void 0,f=e.isComplete?this.getPlayer(r,e.losingPitcherId):void 0,$=this.getDefender(o,l.CATCHER),v=this.getDefender(o,l.FIRST_BASE),y=this.getDefender(o,l.SECOND_BASE),b=this.getDefender(o,l.THIRD_BASE),R=this.getDefender(o,l.SHORTSTOP),P=this.getDefender(o,l.LEFT_FIELD),I=this.getDefender(o,l.CENTER_FIELD),S=this.getDefender(o,l.RIGHT_FIELD);return{...a,runner1B:u,runner2B:p,runner3B:m,hitter:h,pitcher:d,awayPlayer:e.isTopInning?h:d,homePlayer:e.isTopInning?d:h,matchupHandedness:h&&d?this.getMatchupHandedness(h,d):void 0,defense:o,catcher:$,firstBase:v,secondBase:y,thirdBase:b,shortstop:R,leftField:P,centerField:I,rightField:S,winningPitcher:g,losingPitcher:f,showHitter:void 0!==h,showPitcher:void 0!==d}}getLineScore(e){const t=Math.max(9,e.currentInning),i=Array(t).fill(void 0),s=Array(t).fill(void 0);let a=0,r=0,n=0,o=0;for(const t of e.halfInnings??[]){const e=t.num-1,l=t.linescore?.runs??0,c=t.linescore?.hits??0,h=t.linescore?.errors??0;t.top?(i[e]=l,a+=c,n+=h):(s[e]=l,r+=c,o+=h)}return{currentInning:e.currentInning,isTopInning:e.isTopInning,isComplete:e.isComplete,away:{name:e.away.abbrev,innings:i,runs:e.score.away,hits:a,errors:n},home:{name:e.home.abbrev,innings:s,runs:e.score.home,hits:r,errors:o}}}getCurrentDescriptions(e){const t=[],i=this.getAtBatState(e)===P.ENDED?this.getLastPlay(e):this.getCurrentPlay(e);return 0===(e.halfInnings?.length??0)?t.push(...this.playByPlayService.getGameStartDescriptions(e)):i&&this.isFirstPlayOfHalfInning(e,i)&&t.push(...this.playByPlayService.getInningStartDescriptions(i)),i&&t.push(...this.playByPlayService.getPlayDescriptions(e,i)),t}getPlayByPlay(e){return this.playByPlayService.getPlayByPlay(e)}getAtBatState(e){const t=this.getCurrentPlay(e);return t?(t.pitchLog?.pitches?.length??0)>0?P.ONGOING:P.STARTED:void 0!==this.getLastPlay(e)?.result?P.ENDED:void 0}getCurrentPlay(e){const t=this.getPlays(e);for(let e=t.length-1;e>=0;e--)if(void 0===t[e].result)return t[e]}getLastPlay(e){const t=this.getPlays(e);for(let e=t.length-1;e>=0;e--)if(void 0!==t[e].result)return t[e]}getPlays(e){return(e.halfInnings??[]).flatMap(e=>e.plays??[])}getGamePlayers(e){const t={};for(const i of[...e.away.players,...e.home.players])t[i._id]=i;return t}getOffense(e){return e.isTopInning?e.away:e.home}getDefense(e){return e.isTopInning?e.home:e.away}getHitter(e,t=this.getCurrentPlay(e)){if(!e.isComplete&&t)return this.getGamePlayers(e)[t.hitterId]}getPitcher(e){if(e.isComplete)return;const t=this.getDefense(e);return t.players.find(e=>e._id===t.currentPitcherId)}getMatchupHandedness(e,t){const i=e.hits===o.S?t.throws===o.L?o.R:o.L:e.hits;return{throws:t.throws,hits:i,vsSameHand:i===t.throws}}getPlayer(e,t){return t?e[t]:void 0}getDefender(e,t){return e.players.find(e=>e.currentPosition===t)}isFirstPlayOfHalfInning(e,t){const i=(e.halfInnings??[]).find(e=>e.num===t.inningNum&&e.top===t.inningTop);return i?.plays?.[0]?.index===t.index}}class B{playByPlayService;constructor(e){this.playByPlayService=e}getEffectiveHittingRatings(e,t){return t===o.R?e.hittingRatings.vsR:e.hittingRatings.vsL}getEffectivePitchRatings(e,t){const i=t===o.R?e.pitchRatings.vsR:e.pitchRatings.vsL;return{power:e.pitchRatings.power,control:i.control,movement:i.movement}}getPitcherRatingsText(e,t){const i=this.getEffectivePitchRatings(e,t);return`POW ${i.power.toFixed(0)}, CON ${i.control.toFixed(0)}, MOV ${i.movement.toFixed(0)}`}getHitterRatingsText(e,t){const i=this.getEffectiveHittingRatings(e,t);return`CON ${i.contact.toFixed(0)}, GAP ${i.gapPower.toFixed(0)}, HR ${i.homerunPower.toFixed(0)}, EYE ${i.plateDiscipline.toFixed(0)}`}getPitcherGameStats(e){return`${e.pitchResult.ip} IP, ${e.pitchResult.er} ER, ${e.pitchResult.so} K, ${e.pitchResult.bb} BB, ${e.pitchResult.pitches} PC`}getPitcherGameStatsShort(e){return`${e.pitchResult.ip} IP, ${e.pitchResult.er} ER, ${e.pitchResult.so} K`}getHitterGameStats(e){const t=[];return t.push(`${e.hitResult.hits}/${e.hitResult.atBats}`),e.hitResult.bb>0&&t.push(`${e.hitResult.bb>1?e.hitResult.bb:""} BB`.trim()),e.hitResult.hbp>0&&t.push(`${e.hitResult.hbp>1?e.hitResult.hbp:""} HBP`.trim()),e.hitResult.doubles>0&&t.push(`${e.hitResult.doubles>1?e.hitResult.doubles:""} 2B`.trim()),e.hitResult.triples>0&&t.push(`${e.hitResult.triples>1?e.hitResult.triples:""} 3B`.trim()),e.hitResult.homeRuns>0&&t.push(`${e.hitResult.homeRuns>1?e.hitResult.homeRuns:""} HR`.trim()),e.hitResult.rbi>0&&t.push(`${e.hitResult.rbi>1?e.hitResult.rbi:""} RBI`.trim()),t.join(", ")}getHitterGameStatsShort(e){return`${e.hitResult.hits}/${e.hitResult.atBats}`}getPitchHeader(e){return e.quality?`${this.getPitchResultDescription(e)} - ${e.count.balls}-${e.count.strikes} - ${e.quality.velocity?.toFixed(1)} MPH ${this.playByPlayService.getPitchTypeFull(e.type)}`:""}getInPlayHeader(e){return e.contactQuality?`EV ${e.contactQuality.exitVelocity.toFixed(1)} MPH / LA ${e.contactQuality.launchAngle.toFixed(1)}° / Dst ${e.contactQuality.distance?.toFixed(0)} ft`:""}getPitchResultDescription(e){if(e.isWP)return"Wild Pitch";if(e.isPB)return"Passed Ball";switch(e.result){case a.BALL:return"Ball";case a.STRIKE:return e.swing?"Swinging Strike":"Called Strike";case a.FOUL:return"Foul Ball";case a.IN_PLAY:return"In Play";default:return e.swing?"Swinging Strike":"Ball"}}getNumberWithOrdinal(e){const t=e%100;if(t>=11&&t<=13)return`${e}th`;switch(e%10){case 1:return`${e}st`;case 2:return`${e}nd`;case 3:return`${e}rd`;default:return`${e}th`}}getBalls(e,t){return Array.from({length:e},(e,i)=>i<t?"🟡":"⚪").join("")}getMessagesFromPlayDescriptions(e){return e.map(e=>{const t={text:e.text,type:"received",name:"Gamelog"};return e.meta?.pitch&&(e.type===R.RESULT?t.header=this.getInPlayHeader(e.meta.pitch):t.header=this.getPitchHeader(e.meta.pitch)),t})}}!function(e){e.STARTED="STARTED",e.ONGOING="ONGOING",e.ENDED="ENDED"}(P||(P={}));class N{getBoxscoreInfo(e,t){const i=t.team.lineupIds,s=t.team._id,a=t.team.players,r=e.filter(e=>e.teamId===s).sort((e,t)=>(e.playIndex??0)-(t.playIndex??0)),n=this.getSubNumberByPlayerId(r),o=r.filter(e=>e.isPitchingChange),l=r.filter(e=>void 0!==e.lineupIndex),c=this.getBatterAppearanceIds(i,l),h=this.getPitcherAppearanceIds(o),d=this.getRowsFromSubstitutions(c,a,n,e=>i.includes(e._id)||this.hasBattingLine(e)),u=this.getRowsFromSubstitutions(h,a,n,e=>e._id===t.team.currentPitcherId||this.hasPitchingLine(e)),p=a.filter(e=>e.hitResult.doubles>0).map(e=>this.getStatSummary(e,e.hitResult.doubles)),m=a.filter(e=>e.hitResult.triples>0).map(e=>this.getStatSummary(e,e.hitResult.triples)),g=a.filter(e=>e.hitResult.homeRuns>0).map(e=>this.getStatSummary(e,e.hitResult.homeRuns)),f=a.map(e=>({player:e,totalBases:this.getTotalBases(e)})).filter(e=>e.totalBases>0).map(e=>this.getStatSummary(e.player,e.totalBases)),$=a.filter(e=>e.hitResult.rbi>0).map(e=>this.getStatSummary(e,e.hitResult.rbi));return{lineup:i,batters:d,pitchers:u,doubles:p,triples:m,homeRuns:g,totalBases:f,rbi:$}}getSubNumberByPlayerId(e){const t=new Map;let i=1;for(const s of e)s.inPlayerId&&!t.has(s.inPlayerId)&&(t.set(s.inPlayerId,i),i++);return t}getRowsFromSubstitutions(e,t,i,s){const a=[],r=new Set;for(const n of e){const e=this.getPlayer(t,n);e&&s(e)&&(a.push({player:e,subNumber:i.get(e._id)}),r.add(e._id))}for(const e of t)!r.has(e._id)&&s(e)&&(a.push({player:e,subNumber:i.get(e._id)}),r.add(e._id));return a}getPlayer(e,t){return e.find(e=>e._id===t)}hasBattingLine(e){return e.hitResult.atBats>0||e.hitResult.runs>0||e.hitResult.hits>0||e.hitResult.doubles>0||e.hitResult.triples>0||e.hitResult.homeRuns>0||e.hitResult.rbi>0||e.hitResult.bb>0||e.hitResult.hbp>0||e.hitResult.so>0}hasPitchingLine(e){return e.pitchResult.battersFaced>0||e.pitchResult.pitches>0||e.pitchResult.strikes>0||e.pitchResult.hits>0||e.pitchResult.runs>0||e.pitchResult.er>0||e.pitchResult.homeRuns>0||e.pitchResult.bb>0||e.pitchResult.so>0||e.pitchResult.hbp>0}getPitcherAppearanceIds(e){const t=[...e].sort((e,t)=>(e.playIndex??0)-(t.playIndex??0)),i=[],s=new Set,a=e=>{e&&!s.has(e)&&(i.push(e),s.add(e))};t.length>0&&a(t[0].outPlayerId);for(const e of t)a(e.inPlayerId);return i}getBatterAppearanceIds(e,t){const i=t.filter(e=>void 0!==e.lineupIndex).sort((e,t)=>(e.playIndex??0)-(t.playIndex??0)),s=[...e];for(const e of[...i].reverse())void 0!==e.lineupIndex&&s[e.lineupIndex]===e.inPlayerId&&(s[e.lineupIndex]=e.outPlayerId);const a=[],r=new Set,n=e=>{e&&!r.has(e)&&(a.push(e),r.add(e))};for(let e=0;e<s.length;e++){n(s[e]);for(const t of i)t.lineupIndex===e&&n(t.inPlayerId)}return a}getTotalBases(e){return e.hitResult.hits-e.hitResult.doubles-e.hitResult.triples-e.hitResult.homeRuns+2*e.hitResult.doubles+3*e.hitResult.triples+4*e.hitResult.homeRuns}getStatSummary(e,t){return{playerId:e._id,name:e.fullName,value:t}}}class x{getSync(e,t){const i=e.length>0&&!this.isSameMessage(e[0],t[0]);return{clear:i,messages:i?t:this.getNewMessages(e,t)}}getNewMessages(e,t){let i=0;for(;i<e.length&&i<t.length&&this.isSameMessage(e[i],t[i]);)i++;return t.slice(i)}isSameMessage(e,t){return Boolean(e&&t&&e.text===t.text&&e.type===t.type)}}var D=w(391),_=w.n(D);const A={randomUUID:"undefined"!=typeof crypto&&crypto.randomUUID&&crypto.randomUUID.bind(crypto)};let O;const L=new Uint8Array(16);function C(){if(!O&&(O="undefined"!=typeof crypto&&crypto.getRandomValues&&crypto.getRandomValues.bind(crypto),!O))throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");return O(L)}const F=[];for(let e=0;e<256;++e)F.push((e+256).toString(16).slice(1));const H=function(e,t,i){if(A.randomUUID&&!t&&!e)return A.randomUUID();const s=(e=e||{}).random||(e.rng||C)();if(s[6]=15&s[6]|64,s[8]=63&s[8]|128,t){i=i||0;for(let e=0;e<16;++e)t[i+e]=s[e];return t}return function(e,t=0){return F[e[t+0]]+F[e[t+1]]+F[e[t+2]]+F[e[t+3]]+"-"+F[e[t+4]]+F[e[t+5]]+"-"+F[e[t+6]]+F[e[t+7]]+"-"+F[e[t+8]]+F[e[t+9]]+"-"+F[e[t+10]]+F[e[t+11]]+F[e[t+12]]+F[e[t+13]]+F[e[t+14]]+F[e[t+15]]}(s)},k=15e3;class G{simService;game;rng;timer;pitchIntervalMs=k;automatic=!0;paused=!1;onUpdate;onComplete;constructor(e){this.simService=e}start(e,t={}){this.reset();const i={_id:H()},s=t.seed??i._id;this.pitchIntervalMs=t.pitchIntervalMs??k,this.automatic=t.automatic??!0,this.paused=!1,this.onUpdate=t.onUpdate,this.onComplete=t.onComplete,this.rng=t.rng??_()(s,{state:!0});const a=structuredClone(e);return a.game=i,a.date=new Date(e.date),this.simService.initGame(i),this.game=this.simService.startGame(a),this.onUpdate?.(this.game),this.automatic&&this.scheduleNextPitch(),this.game}load(e,t,i={}){return this.reset(),this.game=e,this.pitchIntervalMs=i.pitchIntervalMs??k,this.automatic=i.automatic??!0,this.paused=!1,this.onUpdate=i.onUpdate,this.onComplete=i.onComplete,this.rng=i.rng??_()("",{state:structuredClone(t.rngState)}),this.onUpdate?.(this.game),this.automatic&&!this.game.isFinished&&this.scheduleNextPitch(),this.game}advance(){if(!this.game||!this.rng)throw new Error("Game playback has not been started.");return this.game.isFinished||(this.game.isComplete||this.simService.simPitch(this.game,this.rng),this.game.isComplete&&!this.game.isFinished&&this.simService.finishGame(this.game),this.onUpdate?.(this.game),this.game.isFinished&&(this.clearTimer(),this.onComplete?.(this.game))),this.game}pause(){this.paused=!0,this.clearTimer()}resume(){this.game&&!this.game.isFinished&&this.automatic&&(this.paused=!1,this.scheduleNextPitch())}stop(){this.clearTimer(),this.automatic=!1,this.paused=!1}reset(){this.clearTimer(),this.game=void 0,this.rng=void 0,this.onUpdate=void 0,this.onComplete=void 0,this.pitchIntervalMs=k,this.automatic=!0,this.paused=!1}setAutomatic(e){this.automatic=e,this.clearTimer(),e&&this.game&&!this.game.isFinished&&!this.paused&&this.scheduleNextPitch()}setPitchInterval(e){if(!Number.isFinite(e)||e<0)throw new Error(`Invalid game playback interval: ${e}.`);this.pitchIntervalMs=e,this.automatic&&this.game&&!this.game.isFinished&&!this.paused&&(this.clearTimer(),this.scheduleNextPitch())}setCallbacks(e,t){this.onUpdate=e,this.onComplete=t}getGame(){return this.game}getPlaybackState(){if(!this.rng)throw new Error("Game playback has not been started.");if(!this.rng.state)throw new Error("The current random number generator does not support state persistence.");return{rngState:structuredClone(this.rng.state())}}isAutomatic(){return this.automatic}isPaused(){return this.paused}scheduleNextPitch(){!this.game||this.game.isFinished||this.paused||!this.automatic||this.timer||(this.timer=setTimeout(()=>{this.timer=void 0,this.advance(),this.game&&!this.game.isFinished&&!this.paused&&this.automatic&&this.scheduleNextPitch()},this.pitchIntervalMs))}clearTimer(){void 0!==this.timer&&(clearTimeout(this.timer),this.timer=void 0)}}class U{simService;constructor(e){this.simService=e}createGame(e){const t={_id:H()};this.simService.initGame(t);const i=structuredClone(e);return i.game=t,i.date=new Date(e.date),this.simService.startGame(i),t}simulate(e,t){const i=this.createGame(e),s=_()(t);let a=0;for(;!i.isComplete&&a<1e4;)this.simService.simPitch(i,s),a++;if(!i.isComplete)throw new Error(`Game ${i._id} did not complete after ${a} steps.`);return this.simService.finishGame(i),i}simulateMany(e,t,i={}){if(!Number.isInteger(t)||t<=0)throw new Error("Simulation count must be a positive integer.");const s=i.gameId??String(e.game._id),a=i.seedPrefix??`game-${s}`,r=Array.from({length:t},(e,t)=>t),n=this.simulateIndexes(e,r,{gameId:s,seedPrefix:a,retainGames:i.retainGames});return{summary:this.mergePartialSummaries(e,s,t,[n.summary]),games:n.games}}simulateIndexes(e,t,i={}){const s=i.gameId??String(e.game._id),a=i.seedPrefix??`game-${s}`,r=this.createPartialSummary(),n=i.retainGames?[]:void 0;for(const i of t){if(!Number.isInteger(i)||i<0)throw new Error(`Invalid simulation index: ${i}.`);const t=this.simulate(e,`${a}-${i}`);this.accumulateGame(r,t),n&&n.push(t)}return{summary:r,games:n}}createPartialSummary(){return{simulations:0,awayWins:0,homeWins:0,totalAwayScore:0,totalHomeScore:0,totalInnings:0,players:[]}}accumulateGame(e,t){e.simulations++,e.totalAwayScore+=t.score.away,e.totalHomeScore+=t.score.home,e.totalInnings+=t.currentInning,t.score.away>t.score.home?e.awayWins++:e.homeWins++;const i=new Map(e.players.map(e=>[e.playerId,e]));this.accumulateTeamPlayers(i,t.away),this.accumulateTeamPlayers(i,t.home),e.players=Array.from(i.values())}mergePartialSummaries(e,t,i,s){const a=this.createPartialSummary(),r=new Map;for(const e of s){a.simulations+=e.simulations,a.awayWins+=e.awayWins,a.homeWins+=e.homeWins,a.totalAwayScore+=e.totalAwayScore,a.totalHomeScore+=e.totalHomeScore,a.totalInnings+=e.totalInnings;for(const t of e.players){const e=r.get(t.playerId);e?this.mergePlayerSummary(e,t):r.set(t.playerId,structuredClone(t))}}if(a.simulations!==i)throw new Error(`Expected ${i} simulations for game ${t}, but received ${a.simulations}.`);return{gameId:t,simulations:i,awayTeamId:String(e.away._id),homeTeamId:String(e.home._id),awayWins:a.awayWins,homeWins:a.homeWins,awayWinPercent:a.awayWins/i,homeWinPercent:a.homeWins/i,averageAwayScore:a.totalAwayScore/i,averageHomeScore:a.totalHomeScore/i,averageInnings:a.totalInnings/i,players:Array.from(r.values())}}accumulateTeamPlayers(e,t){for(const i of t.players??[]){const s=this.getOrCreatePlayerSummary(e,i,t),a=Number(i.hitResult?.pa??0),r=Number(i.hitResult?.homeRuns??i.hitResult?.hr??0),n=Number(i.pitchResult?.pitches??0),o=Number(i.pitchResult?.battersFaced??0);a>0&&s.hittingGames++,Number.isFinite(r)&&r>0&&s.homeRunGames++,(n>0||o>0)&&s.pitchingGames++,this.mergeNumericResults(s.hitting,i.hitResult),this.mergeNumericResults(s.pitching,i.pitchResult)}}getOrCreatePlayerSummary(e,t,i){const s=String(t._id),a=e.get(s);if(a)return a;const r=`${t.firstName??""} ${t.lastName??""}`.trim(),n=t.displayName??t.fullName??r,o={playerId:s,name:String(n||s),teamId:String(i._id),teamName:String(i.name??i.abbrev??i._id),hittingGames:0,pitchingGames:0,homeRunGames:0,hitting:{},pitching:{},hittingRatings:structuredClone(t.hittingRatings??{}),pitchRatings:structuredClone(t.pitchRatings??{})};return e.set(s,o),o}mergePlayerSummary(e,t){e.hittingGames+=t.hittingGames,e.pitchingGames+=t.pitchingGames,e.homeRunGames+=t.homeRunGames,this.mergeNumericResults(e.hitting,t.hitting),this.mergeNumericResults(e.pitching,t.pitching),e.hittingRatings&&0!==Object.keys(e.hittingRatings).length||(e.hittingRatings=structuredClone(t.hittingRatings??{})),e.pitchRatings&&0!==Object.keys(e.pitchRatings).length||(e.pitchRatings=structuredClone(t.pitchRatings??{}))}mergeNumericResults(e,t){if(t&&"object"==typeof t)for(const[i,s]of Object.entries(t))"number"==typeof s&&Number.isFinite(s)&&(e[i]=(e[i]??0)+s)}}class M{getStartingPitcher(e){const t=this.getPlayer(e,e.startingPitcher._id);if(!t)throw new Error(`Starting pitcher ${e.startingPitcher._id} was not found.`);return t}getDisplayHitters(e){return e.lineup.order.map(t=>this.getPlayer(e,t._id)).filter(e=>void 0!==e)}getDisplayAvailableHitters(e){const t=new Set(e.lineup.order.map(e=>e._id));return e.players.filter(e=>!this.isPitcher(e)&&!t.has(e._id))}getDisplayAvailablePitchers(e){return e.availablePitchers.map(t=>({...this.getRequiredPlayer(e,t.playerId),role:t.role,priority:t.priority}))}setStartingPitcher(e,t){const i=this.getRequiredPlayer(e,t);if(!this.isPitcher(i))throw new Error(`Invalid starting pitcher: ${t}.`);if(e.startingPitcher._id===t)return;const s=e.startingPitcher._id,a=e.availablePitchers.findIndex(e=>e.playerId===t);a>=0?e.availablePitchers[a].playerId=s:e.availablePitchers.push({playerId:s,role:f.MIDDLE,priority:this.getNextPriority(e.availablePitchers,f.MIDDLE)}),e.startingPitcher={_id:t}}moveHitter(e,t,i){const s=this.getRequiredPlayer(e,t),a=this.getRequiredPlayer(e,i);if(this.isPitcher(s)||this.isPitcher(a))throw new Error("Pitchers cannot be moved through the hitter lineup.");const r=e.lineup.order.findIndex(e=>e._id===t),n=e.lineup.order.findIndex(e=>e._id===i);if(r>=0&&n>=0)this.swapLineupOrder(e,r,n);else if(r>=0)this.replaceLineupPlayer(e,r,a);else{if(!(n>=0))throw new Error("At least one hitter must currently be in the lineup.");this.replaceLineupPlayer(e,n,s)}}moveHitterToLineup(e,t,i){const s=this.getRequiredPlayer(e,t),a=e.lineup.order[i];if(!a)throw new Error(`Invalid lineup index: ${i}.`);if(this.isPitcher(s))throw new Error("Pitchers cannot be added to the hitting lineup.");const r=e.lineup.order.findIndex(e=>e._id===t);if(r>=0)this.swapLineupOrder(e,r,i);else{if(!this.playerCanPlay(s,a.position))throw new Error(`${s.fullName} cannot play ${a.position}.`);e.lineup.order[i]={...a,_id:t}}}moveBullpenPitcher(e,t,i){const s=this.getRequiredPlayer(e,t),a=this.getRequiredPlayer(e,i);if(!this.isPitcher(s)||!this.isPitcher(a))throw new Error("Only pitchers can be moved in the bullpen.");if(t===e.startingPitcher._id)return void this.setStartingPitcher(e,i);if(i===e.startingPitcher._id)return void this.setStartingPitcher(e,t);const r=e.availablePitchers.findIndex(e=>e.playerId===t),n=e.availablePitchers.findIndex(e=>e.playerId===i);if(r<0||n<0)throw new Error("Both pitchers must have bullpen assignments.");const o=e.availablePitchers[r].playerId,l=e.availablePitchers[n].playerId;e.availablePitchers[r].playerId=l,e.availablePitchers[n].playerId=o}setBullpenRole(e,t,i,s=1){const a=this.getRequiredPlayer(e,t);if(!this.isPitcher(a))throw new Error(`${a.fullName} is not a pitcher.`);if(t===e.startingPitcher._id)throw new Error("The starting pitcher cannot have a bullpen role.");const r=e.availablePitchers.find(e=>e.playerId===t);if(r)return r.role=i,void(r.priority=s);e.availablePitchers.push({playerId:t,role:i,priority:s})}setBullpenPriority(e,t,i){if(!Number.isInteger(i)||i<1)throw new Error(`Invalid bullpen priority: ${i}.`);const s=e.availablePitchers.find(e=>e.playerId===t);if(!s)throw new Error(`Bullpen assignment for ${t} was not found.`);s.priority=i}getBullpenRoleDisplay(e){return e===f.CLOSER?"Closer":e===f.SETUP?"Setup":e===f.MIDDLE?"Middle Relief":e===f.LONG?"Long Relief":e===f.MOP_UP?"Mop Up":""}playerCanPlay(e,t){return this.getPositionFitScore(e,t)>0}getPlayer(e,t){if(t)return e.players.find(e=>e._id===t)}getRequiredPlayer(e,t){const i=this.getPlayer(e,t);if(!i)throw new Error(`Player ${t} was not found.`);return i}swapLineupOrder(e,t,i){const s=e.lineup.order[t];e.lineup.order[t]=e.lineup.order[i],e.lineup.order[i]=s}replaceLineupPlayer(e,t,i){const s=e.lineup.order[t];if(!this.playerCanPlay(i,s.position))throw new Error(`${i.fullName} cannot play ${s.position}.`);e.lineup.order[t]={...s,_id:i._id}}isPitcher(e){return e.primaryPosition===l.PITCHER}getPositionFitScore(e,t){return this.isPitcher(e)?0:t===l.DESIGNATED_HITTER?1:e.primaryPosition===t?100:0}getNextPriority(e,t){const i=e.filter(e=>e.role===t).map(e=>e.priority??0);return i.length>0?Math.max(...i)+1:1}}function W(e){let t=e.vm;return function(e){e.$;var i=e.$h;return e.$root,e.$f7,e.$f7route,e.$f7router,e.$theme,e.$update,e.$store,i`

  ${t?i`

    <table class="linescore">

      <thead>

        <tr>

          <th></th>

          ${Array.from({length:t.away.innings.length},(e,t)=>t+1).map(e=>i`

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

            ${t.isTopInning&&!t.isComplete?i`

              <strong>${t.away.name}</strong>

            `:t.away.name}

          </td>

          ${t.away.innings.map((e,s)=>i`

            <td class="align-center ${t.currentInning===s+1&&t.isTopInning&&!t.isComplete?"current":""}">

              ${e??""}

            </td>

          `)}

          <td class="align-center">${t.away.runs}</td>

          <td class="align-center">${t.away.hits}</td>

          <td class="align-center">${t.away.errors}</td>

        </tr>

        <tr>

          <td>

            ${t.isTopInning||t.isComplete?t.home.name:i`

              <strong>${t.home.name}</strong>

            `}

          </td>

          ${t.home.innings.map((e,s)=>i`

            <td class="align-center ${t.currentInning!==s+1||t.isTopInning||t.isComplete?"":"current"}">

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

`}}W.id="3d53a4fa7c",W.style="\n\n";const Y=W;function j(e){let t=e.playbyplay??[],i=e.gameplayers??{},s=e.gameviewservice;return function(e){e.$;var a=e.$h;return e.$root,e.$f7,e.$f7route,e.$f7router,e.$theme,e.$update,e.$store,a`

  <div class="game-log">

    <div class="list cards-list">

      <ul>

        ${t.filter(e=>void 0!==e.play?.result).map(e=>a`

          <li class="card recap card-header-divider card-outline">

            <div class="card-header">

              ${e.play.inningTop?"Top of":"Bottom of"} ${s.getNumberWithOrdinal(e.play.inningNum)} Inning

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

              ${e.descriptions.map(e=>a`

                <div class="message message-received ${"RESULT"===e.type?"main":""}">

                  <div class="message-content">

                    ${e.meta?.pitch?a`

                      <div class="message-header">

                        ${"RESULT"===e.type?s.getInPlayHeader(e.meta.pitch):s.getPitchHeader(e.meta.pitch)}

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

                ${s.getBalls(3,e.play.count?.end?.outs??0)}

              </div>

              ${e.play.credits?.length>0?a`

                <div class="defense">

                  <strong>Defense</strong>

                  <ul>

                    ${e.play.credits.map(e=>{const t=i[e._id];return a`

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

`}}j.id="9ff8061892",j.style="\n\n\n\n";const K=j;function q(e,{$h:t}){let i=e.vm,s=e.gameviewservice,a=e.fieldimageurl,r=e.getplayerimageurl,n=e.getplayerhref,o=e.getboxscorehref,l=e.getgameloghref,c=!0===e.paused,h=e.advancecallback,d=e.pausecallback,u=e.resumecallback,p=e.simtoendcallback,m=e.awaycolor||"#0A3161",g=e.homecolor||"#B31942";const f=e=>{const t=String(e).replace("#","");return.299*parseInt(t.substring(0,2),16)+.587*parseInt(t.substring(2,4),16)+.114*parseInt(t.substring(4,6),16)>160?"#000000":"#ffffff"};let $=f(m),v=f(g);const y=e=>e.lineupIds.map(t=>e.players.find(e=>e._id===t)).filter(e=>e),b=e=>null==e?"color-gray":e>=146?"color-green":e>=122?"color-blue":e>=83?"color-yellow":e>=47?"color-orange":"color-red",R=e=>null==e?"":e>=170?"A+":e>=158?"A":e>=146?"A-":e>=134?"B+":e>=122?"B":e>=110?"B-":e>=95?"C+":e>=83?"C":e>=71?"C-":e>=59?"D+":e>=47?"D":e>=35?"D-":"F",P=async()=>{h&&await h()},I=async()=>{d&&await d()},S=async()=>{u&&await u()},w=async()=>{p&&await p()};return function(e){e.$;var t=e.$h;return e.$root,e.$f7,e.$f7route,e.$f7router,e.$theme,e.$update,e.$store,t`

  <div class="game-state ${i.isTopInning?"top-inning":"bottom-inning"}" style="--away-color: ${m}; --home-color: ${g}; --away-font-color: ${$}; --home-font-color: ${v};">

    <div class="game-summary">

      <div class="game-score">
        <table>
          <tr class="${i.isTopInning?"at-bat":""}">
            <td class="name" style="background-color: ${m}; color: ${$};">
              <strong>${i.game.away.abbrev}</strong>
            </td>
            <td class="runs">${i.score.away}</td>
            <td class="inning" rowspan="2">
              ${i.isTopInning?t`▲ ${i.currentInning}`:t`${i.currentInning} ▼`}
            </td>
          </tr>

          <tr class="${i.isTopInning?"":"at-bat"}">
            <td class="name" style="background-color: ${g}; color: ${v};">
              <strong>${i.game.home.abbrev}</strong>
            </td>
            <td class="runs">${i.score.home}</td>
          </tr>
        </table>
      </div>

      <div class="state-info">

        <div class="info-wrapper">
          <span class="label">B</span>${s.getBalls(3,i.balls)}<br />
          <span class="label">S</span>${s.getBalls(2,i.strikes)}<br />
          <span class="label">O</span>${s.getBalls(2,i.outs)}
        </div>

        <div class="diamond-wrapper">
          <div class="diamond">
            <div class="first base ${i.runner1B?"runner":""}"></div>
            <div class="second base ${i.runner2B?"runner":""}"></div>
            <div class="third base ${i.runner3B?"runner":""}"></div>
          </div>
        </div>

      </div>

    </div>


    <div class="game-main">

      <div class="left">
        <div class="content">

          <div class="card card-raised ${i.atBatBoxscore.team._id===i.awayBoxscore.team._id?"card-atbat":"card-notatbat"}">

            <div class="card-header">
              ${i.awayBoxscore.team.name??i.awayBoxscore.team.abbrev}
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

                  ${y(i.awayBoxscore.team).map((e,a)=>t`
                    <tr class="${i.atBatBoxscore.team._id===i.awayBoxscore.team._id&&i.awayBoxscore.team.currentHitterIndex===a?"at-bat":""}">

                      <td class="num order">${a+1}</td>

                      <td class="image">
                        ${r?t`
                          <img src="${r(e)}" />
                        `:t``}
                      </td>

                      <td class="name">
                        ${n?t`
                          <a href="${n(e)}">${e.displayName??e.fullName}</a>
                        `:t`
                          ${e.displayName??e.fullName}
                        `}
                      </td>

                      <td>${e.hits}</td>
                      <td class="pos">${e.currentPosition}</td>
                      <td class="stats">${s.getHitterGameStatsShort(e)}</td>

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

            ${a?t`
              <img src="${a}" class="field-image" />
            `:t``}


            ${i.showHitter&&i.hitter?t`
              <a href="${n?n(i.hitter):"#"}" class="runner hitter offense-player ${"R"===i.matchupHandedness?.hits?"rhb":"lhb"}">

                ${"L"===i.matchupHandedness?.hits&&r?t`
                  <div class="image">
                    <img src="${r(i.hitter)}" />
                  </div>
                `:t``}

                <div class="wrapper">
                  <div class="text">${i.hitter.displayName??i.hitter.fullName}</div>

                  <div class="game-stats">
                    ${s.getHitterGameStatsShort(i.hitter)}
                  </div>
                </div>

                ${"R"===i.matchupHandedness?.hits&&r?t`
                  <div class="image">
                    <img src="${r(i.hitter)}" />
                  </div>
                `:t``}

              </a>
            `:t``}


            ${i.runner1B?t`
              <a href="${n?n(i.runner1B):"#"}" class="runner firstBase offense-player">

                ${r?t`
                  <div class="image">
                    <img src="${r(i.runner1B)}" />
                  </div>
                `:t``}

                <div class="wrapper">
                  <div class="text">${i.runner1B.displayName??i.runner1B.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${b(i.runner1B.hittingRatings.speed)}">${R(i.runner1B.hittingRatings.speed)}</div>
                      <div class="chip-label">SPD</div>
                    </div>
                  </div>
                </div>

              </a>
            `:t``}


            ${i.runner2B?t`
              <a href="${n?n(i.runner2B):"#"}" class="runner secondBase offense-player">

                <div class="wrapper">
                  <div class="text">${i.runner2B.displayName??i.runner2B.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${b(i.runner2B.hittingRatings.speed)}">${R(i.runner2B.hittingRatings.speed)}</div>
                      <div class="chip-label">SPD</div>
                    </div>
                  </div>
                </div>

                ${r?t`
                  <div class="image">
                    <img src="${r(i.runner2B)}" />
                  </div>
                `:t``}

              </a>
            `:t``}


            ${i.runner3B?t`
              <a href="${n?n(i.runner3B):"#"}" class="runner thirdBase offense-player">

                ${r?t`
                  <div class="image">
                    <img src="${r(i.runner3B)}" />
                  </div>
                `:t``}

                <div class="wrapper">
                  <div class="text">${i.runner3B.displayName??i.runner3B.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${b(i.runner3B.hittingRatings.speed)}">${R(i.runner3B.hittingRatings.speed)}</div>
                      <div class="chip-label">SPD</div>
                    </div>
                  </div>
                </div>

              </a>
            `:t``}


            ${i.showPitcher&&i.pitcher?t`
              <a href="${n?n(i.pitcher):"#"}" class="defender p defense-player" data-pos="P">

                <div class="wrapper">
                  <div class="text">${i.pitcher.displayName??i.pitcher.fullName}</div>

                  <div class="game-stats">
                    ${s.getPitcherGameStatsShort(i.pitcher)}
                  </div>
                </div>

                ${r?t`
                  <div class="image">
                    <img src="${r(i.pitcher)}" />
                  </div>
                `:t``}

              </a>
            `:t``}


            ${i.showPitcher&&i.catcher?t`
              <a href="${n?n(i.catcher):"#"}" class="defender c top defense-player" data-pos="C">

                ${r?t`
                  <div class="image">
                    <img src="${r(i.catcher)}" />
                  </div>
                `:t``}

                <div class="wrapper">
                  <div class="text">${i.catcher.displayName??i.catcher.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${b(i.catcher.hittingRatings.arm)}">${R(i.catcher.hittingRatings.arm)}</div>
                      <div class="chip-label">ARM</div>
                    </div>
                  </div>
                </div>

              </a>
            `:t``}


            ${i.showPitcher&&i.firstBase?t`
              <a href="${n?n(i.firstBase):"#"}" class="defender firstBase defense-player" data-pos="1B">

                <div class="wrapper">
                  <div class="text">${i.firstBase.displayName??i.firstBase.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${b(i.firstBase.hittingRatings.defense)}">${R(i.firstBase.hittingRatings.defense)}</div>
                      <div class="chip-label">DEF</div>
                    </div>
                  </div>
                </div>

                ${r?t`
                  <div class="image">
                    <img src="${r(i.firstBase)}" />
                  </div>
                `:t``}

              </a>
            `:t``}


            ${i.showPitcher&&i.secondBase?t`
              <a href="${n?n(i.secondBase):"#"}" class="defender secondBase defense-player" data-pos="2B">

                <div class="wrapper">
                  <div class="text">${i.secondBase.displayName??i.secondBase.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${b(i.secondBase.hittingRatings.defense)}">${R(i.secondBase.hittingRatings.defense)}</div>
                      <div class="chip-label">DEF</div>
                    </div>
                  </div>
                </div>

                ${r?t`
                  <div class="image">
                    <img src="${r(i.secondBase)}" />
                  </div>
                `:t``}

              </a>
            `:t``}


            ${i.showPitcher&&i.thirdBase?t`
              <a href="${n?n(i.thirdBase):"#"}" class="defender thirdBase defense-player" data-pos="3B">

                <div class="wrapper">
                  <div class="text">${i.thirdBase.displayName??i.thirdBase.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${b(i.thirdBase.hittingRatings.defense)}">${R(i.thirdBase.hittingRatings.defense)}</div>
                      <div class="chip-label">DEF</div>
                    </div>
                  </div>
                </div>

                ${r?t`
                  <div class="image">
                    <img src="${r(i.thirdBase)}" />
                  </div>
                `:t``}

              </a>
            `:t``}


            ${i.showPitcher&&i.shortstop?t`
              <a href="${n?n(i.shortstop):"#"}" class="defender ss defense-player" data-pos="SS">

                <div class="wrapper">
                  <div class="text">${i.shortstop.displayName??i.shortstop.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${b(i.shortstop.hittingRatings.defense)}">${R(i.shortstop.hittingRatings.defense)}</div>
                      <div class="chip-label">DEF</div>
                    </div>
                  </div>
                </div>

                ${r?t`
                  <div class="image">
                    <img src="${r(i.shortstop)}" />
                  </div>
                `:t``}

              </a>
            `:t``}


            ${i.showPitcher&&i.leftField?t`
              <a href="${n?n(i.leftField):"#"}" class="defender lf defense-player" data-pos="LF">

                <div class="wrapper">
                  <div class="text">${i.leftField.displayName??i.leftField.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${b(i.leftField.hittingRatings.defense)}">${R(i.leftField.hittingRatings.defense)}</div>
                      <div class="chip-label">DEF</div>
                    </div>
                  </div>
                </div>

                ${r?t`
                  <div class="image">
                    <img src="${r(i.leftField)}" />
                  </div>
                `:t``}

              </a>
            `:t``}


            ${i.showPitcher&&i.centerField?t`
              <a href="${n?n(i.centerField):"#"}" class="defender cf defense-player" data-pos="CF">

                <div class="wrapper">
                  <div class="text">${i.centerField.displayName??i.centerField.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${b(i.centerField.hittingRatings.defense)}">${R(i.centerField.hittingRatings.defense)}</div>
                      <div class="chip-label">DEF</div>
                    </div>
                  </div>
                </div>

                ${r?t`
                  <div class="image">
                    <img src="${r(i.centerField)}" />
                  </div>
                `:t``}

              </a>
            `:t``}


            ${i.showPitcher&&i.rightField?t`
              <a href="${n?n(i.rightField):"#"}" class="defender rf defense-player" data-pos="RF">

                <div class="wrapper">
                  <div class="text">${i.rightField.displayName??i.rightField.fullName}</div>

                  <div class="game-stats">
                    <div class="chip">
                      <div class="chip-media bg-${b(i.rightField.hittingRatings.defense)}">${R(i.rightField.hittingRatings.defense)}</div>
                      <div class="chip-label">DEF</div>
                    </div>
                  </div>
                </div>

                ${r?t`
                  <div class="image">
                    <img src="${r(i.rightField)}" />
                  </div>
                `:t``}

              </a>
            `:t``}


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

          <div class="card card-raised ${i.atBatBoxscore.team._id===i.homeBoxscore.team._id?"card-atbat":"card-notatbat"}">

            <div class="card-header">
              ${i.homeBoxscore.team.name??i.homeBoxscore.team.abbrev}
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

                  ${y(i.homeBoxscore.team).map((e,a)=>t`
                    <tr class="${i.atBatBoxscore.team._id===i.homeBoxscore.team._id&&i.homeBoxscore.team.currentHitterIndex===a?"at-bat":""}">

                      <td class="num order">${a+1}</td>

                      <td class="image">
                        ${r?t`
                          <img src="${r(e)}" />
                        `:t``}
                      </td>

                      <td class="name">
                        ${n?t`
                          <a href="${n(e)}">${e.displayName??e.fullName}</a>
                        `:t`
                          ${e.displayName??e.fullName}
                        `}
                      </td>

                      <td>${e.hits}</td>
                      <td class="pos">${e.currentPosition}</td>
                      <td class="stats">${s.getHitterGameStatsShort(e)}</td>

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

        <div class="matchup-detail away" style="background-color: ${m}; color: ${$};">

          ${i.awayPlayer?t`
            ${r?t`
              <span class="icon">
                <img src="${r(i.awayPlayer)}" />
              </span>
            `:t``}

            <div class="label">${i.awayPlayer._id===i.pitcher?._id?"Pitching":"At Bat"}</div>

            <div class="player">
              ${n?t`
                <a href="${n(i.awayPlayer)}" style="color: inherit;">${i.awayPlayer.displayName??i.awayPlayer.fullName}</a>
              `:t`
                ${i.awayPlayer.displayName??i.awayPlayer.fullName}
              `}
            </div>

            <div class="game-stats">
              ${i.awayPlayer._id===i.pitcher?._id?s.getPitcherGameStats(i.awayPlayer):s.getHitterGameStats(i.awayPlayer)}
            </div>
          `:t``}

        </div>


        <div class="matchup-detail" style="background-color: ${g}; color: ${v};">

          ${i.homePlayer?t`
            ${r?t`
              <span class="icon">
                <img src="${r(i.homePlayer)}" />
              </span>
            `:t``}

            <div class="label">${i.homePlayer._id===i.pitcher?._id?"Pitching":"At Bat"}</div>

            <div class="player">
              ${n?t`
                <a href="${n(i.homePlayer)}" style="color: inherit;">${i.homePlayer.displayName??i.homePlayer.fullName}</a>
              `:t`
                ${i.homePlayer.displayName??i.homePlayer.fullName}
              `}
            </div>

            <div class="game-stats">
              ${i.homePlayer._id===i.pitcher?._id?s.getPitcherGameStats(i.homePlayer):s.getHitterGameStats(i.homePlayer)}
            </div>
          `:t``}

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
                ${c?t`
                  <a href="#" class="list-button popover-close" @click=${S}>Resume</a>
                `:t`
                  <a href="#" class="list-button popover-close" @click=${I}>Pause</a>
                `}
              </li>
              ${c?t`
                <li>
                  <a href="#" class="list-button popover-close" @click=${P}>Next Pitch</a>
                </li>
              `:t` `}
              <li>
                <a href="#" class="list-button popover-close" @click=${w}>Sim to End</a>
              </li>
              ${o?t`
                <li>
                  <a href="${o(i.game)}" class="list-button popover-close">Box Score</a>
                </li>
              `:t``}
              ${l?t`
                <li>
                  <a href="${l(i.game)}" class="list-button popover-close">Game Log</a>
                </li>
              `:t``}
            </ul>
          </div>
        </div>
      </div>

    </div>

  </div>

`}}q.id="68e5d4ca33",q.style="\n\n.game-state.top-inning .offense-player .wrapper,\n.game-state.bottom-inning .defense-player .wrapper {\n  border: 2px solid var(--away-color);\n}\n\n.game-state.top-inning .offense-player .text,\n.game-state.bottom-inning .defense-player .text {\n  background: var(--away-color);\n  color: var(--away-font-color);\n}\n\n.game-state.top-inning .offense-player img,\n.game-state.bottom-inning .defense-player img {\n  border-color: var(--away-color);\n}\n\n.game-state.top-inning .defense-player .wrapper,\n.game-state.bottom-inning .offense-player .wrapper {\n  border: 2px solid var(--home-color);\n}\n\n.game-state.top-inning .defense-player .text,\n.game-state.bottom-inning .offense-player .text {\n  background: var(--home-color);\n  color: var(--home-font-color);\n}\n\n.game-state.top-inning .defense-player img,\n.game-state.bottom-inning .offense-player img {\n  border-color: var(--home-color);\n}\n\n.game-state .offense-player .text,\n.game-state .defense-player .text {\n  text-decoration: none;\n}\n\n";const V=q;function z(e){let t=e.vm,i=e.substitutions??[],s=e.boxscoreservice,a=e.getplayerimageurl,r=e.getplayerhref;const n=s.getBoxscoreInfo(i,t),o=e=>e.map(e=>`${e.name}${e.value>1?` ${e.value}`:""}`).join("; ");return function(e){e.$;var i=e.$h;return e.$root,e.$f7,e.$f7route,e.$f7router,e.$theme,e.$update,e.$store,i`

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

          ${n.batters.map(e=>{return i`
            <tr class="${s=e.player,t.isComplete||t.team.lineupIds[t.team.currentHitterIndex]!==s._id?"":t.isTopInning&&"AWAY"===t.side||!t.isTopInning&&"HOME"===t.side?"at-bat":"at-bat-next"}">

              <td class="image">
                ${a?i`
                  <img src="${a(e.player)}" />
                `:" "}
              </td>

              <td class="name">
                ${e.subNumber?`${e.subNumber}-`:" "}

                ${r?i`
                  <a href="${r(e.player)}">${e.player.fullName}</a>
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
          `;var s})}

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

          ${n.pitchers.map(e=>{return i`
            <tr class="${s=e.player,t.isComplete||t.team.currentPitcherId!==s._id?"":t.isTopInning&&"HOME"===t.side||!t.isTopInning&&"AWAY"===t.side?"pitching":""}">

              <td class="image">
                ${a?i`
                  <img src="${a(e.player)}" />
                `:" "}
              </td>

              <td class="name">
                ${e.subNumber?`${e.subNumber}-`:" "}

                ${r?i`
                  <a href="${r(e.player)}">${e.player.fullName}</a>
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
          `;var s})}

        </tbody>

      </table>
    </div>


    <div class="batter-summary">

      ${n.doubles.length>0?i`
        <strong>2B:</strong> ${o(n.doubles)}<br />
      `:" "}

      ${n.triples.length>0?i`
        <strong>3B:</strong> ${o(n.triples)}<br />
      `:" "}

      ${n.homeRuns.length>0?i`
        <strong>HR:</strong> ${o(n.homeRuns)}<br />
      `:" "}

      ${n.totalBases.length>0?i`
        <strong>TB:</strong> ${o(n.totalBases)}<br />
      `:" "}

      ${n.rbi.length>0?i`
        <strong>RBI:</strong> ${o(n.rbi)}<br />
      `:" "}

    </div>

  </div>

`}}z.id="6b4f6b7426",z.style="\n\n\n";const Z=z;function Q(e,{$onMounted:t,$onUpdated:i,$onBeforeUnmount:s,$:a,$f7:r,$update:n}){let o,l=e.gamewebservice,c=e.gameviewservice,h=e.gamemessageservice,d=e.boxscoreservice,u=e.game,p=e.fieldimageurl,m=e.getplayerimageurl,g=e.getplayerhref,f=e.getboxscorehref,$=e.getgameloghref,v=!0===e.paused,y=e.advancecallback,b=e.pausecallback,R=e.resumecallback,P=e.simtoendcallback,I=u?l.getGameViewModel(u):void 0,S=0,w=Promise.resolve(),T=[".at-bat-ended"],E=u;const B=()=>{if(!u)return void(I=void 0);const e=l.getGameViewModel(u);I?Object.assign(I,e):I=e},N=()=>{for(const e of T)a(e).hide()},x=async e=>{if(!u)return;const t=l.getCurrentDescriptions(u),i=(e=>c.getMessagesFromPlayDescriptions(e))(t);((e,t)=>{if("ENDED"===e){const e=t.find(e=>"RESULT"===e.type)?.text??"";return a(".at-bat-ended .result").text(e),void(e=>{for(const t of T)t!==e&&a(t).hide();a(e).css("display","flex")})(".at-bat-ended")}N()})(l.getAtBatState(u),t),await(async(e,t)=>{if(!o)return;const i=o.messages??[],s=h.getSync(i,e);S++;const a=S;w=w.then(async()=>{if(a===S){s.clear&&o.clear();for(const e of s.messages){if(a!==S)return;if(t&&(o.showTyping(),await D(500)),a!==S)return;o.addMessage(e),o.hideTyping()}}}),await w})(i,e)},D=e=>new Promise(t=>setTimeout(t,e)),_=()=>new Promise(e=>requestAnimationFrame(e));return t(async()=>{u&&(B(),await n(),await _(),await _(),o=(()=>{const e=r.messages?.get(".game-messages");return e||r.messages?.create({el:".game-messages",scrollMessages:!0,scrollMessagesOnEdge:!0})})(),await x(!1),o&&o.scroll(0))}),i(async()=>{await(async()=>{v=!0===e.paused,y=e.advancecallback,b=e.pausecallback,R=e.resumecallback,P=e.simtoendcallback,e.game!==E&&(u=e.game,E=e.game,B(),await x(!1))})()}),s(()=>{S++,N()}),function(e){e.$;var t=e.$h;return e.$root,e.$f7,e.$f7route,e.$f7router,e.$theme,e.$update,e.$store,t`

  <div class="game-page">

    ${I?.game?t`

      <${V}
        vm=${I}
        gameviewservice=${c}
        fieldimageurl=${p}
        getplayerimageurl=${m}
        getplayerhref=${g}
        getboxscorehref=${f}
        getgameloghref=${$}
        paused=${v}
        advancecallback=${y}
        pausecallback=${b}
        resumecallback=${R}
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
                  <${Y}
                    vm=${I.linescore}
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 large-grid-cols-2">
                <${Z}
                  substitutions=${I.game.substitutions??[]}
                  vm=${I.awayBoxscore}
                  boxscoreservice=${d}
                  getplayerimageurl=${m}
                  getplayerhref=${g}
                />

                <${Z}
                  substitutions=${I.game.substitutions??[]}
                  vm=${I.homeBoxscore}
                  boxscoreservice=${d}
                  getplayerimageurl=${m}
                  getplayerhref=${g}
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

`}}Q.id="abf791d099",Q.style="\n\n\n";const X=Q,J=new T,ee=new E(J),te=new B(J),ie=new x,se=new N,ae=new M;export{P as AtBatState,Z as BoxscoreComponent,N as BoxscoreService,X as GameInProgressComponent,K as GameLogComponent,x as GameMessageService,G as GamePlaybackService,U as GameSimulationService,V as GameStateComponent,B as GameViewService,E as GameWebService,Y as LineScoreComponent,T as PlayByPlayService,R as PlayDescriptionType,M as TeamComponentService,se as boxscoreService,ie as gameMessageService,te as gameViewService,ee as gameWebService,J as playByPlayService,ae as teamComponentService};