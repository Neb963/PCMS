// Packaged first-party baselines. Updates never replace an existing registry.
export const bundledContract={
 'pcms-accounts':{version:'0.3.0',capabilities:['records.accounts','persona.prepare','persona.check','persona.open','persona.repair'],packageClass:'bundled-accounts'},
 'pcms-discover':{version:'0.3.0',pages:[{id:'check-slugs',title:'Check slugs',html:'page.html',script:'page.js',style:'page.css'}],capabilities:['records.discover','jobs.discover','perchance.classify','github.prepareFolder'],packageClass:null},
 'pcms-creator':{version:'0.3.0',capabilities:['records.creator','jobs.creator','perchance.ownership','perchance.create','perchance.classify'],packageClass:null},
 'pcms-deployer':{version:'0.2.0',capabilities:['records.deployer','jobs.deployer','perchance.source'],packageClass:null},
 'pcms-refresher':{version:'0.1.0',capabilities:[],packageClass:null},
 'pcms-journal':{version:'0.3.0',capabilities:['journal.query','journal.export','journal.cleanup'],packageClass:'bundled-journal'},
 'pcms-backup':{version:'0.3.0',capabilities:['backup.capture','backup.captureCut'],packageClass:'bundled-backup'}
};
