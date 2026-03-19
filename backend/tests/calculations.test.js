import { calculateBenefits } from '../routes/rest_calculations.js';

describe('Benefit Calculations Mathematical Engine', () => {
  it('should strictly render exactly policy_term number of years in the array', () => {
    const age = 30;
    const policy_term = 10;
    const premium = 5000;
    
    const results = calculateBenefits(age, policy_term, policy_term, premium);
    
    expect(results).toHaveLength(10);
    expect(results[0].year).toBe(1);
    expect(results[0].age).toBe(31);
    expect(results[9].year).toBe(10);
    expect(results[9].age).toBe(40);
  });

  it('should accurately compound the 8% interest and calculate the 10x death benefit', () => {
    const age = 30;
    const policy_term = 3; 
    const premium = 10000;
    
    const results = calculateBenefits(age, policy_term, policy_term, premium);
    
    // Year 1: (0 + 10000) * 1.08 = 10800
    expect(results[0].projected_fund_value).toBe(10800);
    // Death benefit is traditionally max(10 * premium, fund_value)
    expect(results[0].death_benefit).toBe(100000); 
    
    // Year 2: (10800 + 10000) * 1.08 = 22464
    expect(results[1].projected_fund_value).toBe(22464);
    expect(results[1].death_benefit).toBe(100000); 
    
    // Year 3: (22464 + 10000) * 1.08 = 35061.12
    expect(results[2].projected_fund_value).toBe(35061.12);
    expect(results[2].death_benefit).toBe(100000); 
  });
});
