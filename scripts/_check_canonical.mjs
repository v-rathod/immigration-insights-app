import { readFileSync } from 'fs';

const wr = JSON.parse(readFileSync('public/data/dashboards/employer/employer_wage_rankings.json', 'utf8'));
const allcapsWr = wr.filter(r => r.employer_name && r.employer_name === r.employer_name.toUpperCase() && r.employer_name.length > 4 && !/^\d+$/.test(r.employer_name));
console.log('wage_rankings all-caps:', allcapsWr.slice(0, 5).map(r => r.employer_name));

const dim = JSON.parse(readFileSync('public/data/dims/dim_employer.json', 'utf8'));
const allcapsDim = dim.filter(r => r.employer_name && r.employer_name === r.employer_name.toUpperCase() && r.employer_name.length > 4 && !/^\d+$/.test(r.employer_name));
console.log('dim_employer all-caps long:', allcapsDim.slice(0, 5).map(r => r.employer_name));
console.log('dim_employer total rows:', dim.length);

const st = JSON.parse(readFileSync('public/data/dashboards/wage/employer_salary_trend.json', 'utf8'));
const allcapsSt = st.filter(r => r.employer_name && r.employer_name === r.employer_name.toUpperCase() && r.employer_name.length > 4 && !/^\d+$/.test(r.employer_name));
console.log('salary_trend all-caps:', allcapsSt.slice(0, 5).map(r => r.employer_name));
console.log('salary_trend total rows:', st.length);

// Check a formerly problematic employer
const infosys = wr.filter(r => r.employer_name && r.employer_name.toLowerCase().includes('infosys'));
console.log('Infosys entries in wage_rankings:', infosys.map(r => r.employer_name));
