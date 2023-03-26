import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CostAnalyzerComponent } from './cost-analyzer.component';

describe('CostAnalyzerComponent', () => {
  let component: CostAnalyzerComponent;
  let fixture: ComponentFixture<CostAnalyzerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CostAnalyzerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CostAnalyzerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
