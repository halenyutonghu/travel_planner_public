import beijing from '../src/data/beijing';
import shanghai from '../src/data/shanghai';
import guangzhou from '../src/data/guangzhou';
import kunming from '../src/data/kunming';
import nanjing from '../src/data/nanjing';
import { validateCityData } from '../src/data/validator';

const cities = [beijing, shanghai, guangzhou, kunming, nanjing];
const issues = cities.flatMap((city) => validateCityData(city).map((item) => ({ ...item, file: `${city.name}/${item.file}` })));
if (issues.length > 0) {
  for (const item of issues) console.error(`${item.file} / ${item.recordId} / ${item.field}: ${item.message}`);
  throw new Error(`静态模拟数据校验失败，共 ${issues.length} 项`);
} else {
  console.log('北京、上海、广州、昆明、南京静态模拟数据校验通过');
}
