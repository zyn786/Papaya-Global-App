import Config from '../models/Config.js';

export async function getConfig(_,res){
  const cfg = await Config.findOne();
  res.json(cfg || { currencyCode:'USD', bonusRate:0.04, fixedPerTask:1 });
}
export async function saveConfig(req,res){
  const { currencyCode, bonusRate, fixedPerTask } = req.body;
  const cfg = await Config.findOne() || new Config();
  if (currencyCode) cfg.currencyCode = currencyCode;
  if (typeof bonusRate === 'number') cfg.bonusRate = bonusRate;
  if (typeof fixedPerTask === 'number') cfg.fixedPerTask = fixedPerTask;
  await cfg.save();
  res.json(cfg);
}
