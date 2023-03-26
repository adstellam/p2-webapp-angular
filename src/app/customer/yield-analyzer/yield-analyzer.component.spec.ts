import { ComponentFixture, TestBed } from '@angular/core/testing';

import { YieldAnalyzerComponent } from './yield-analyzer.component';

describe('YieldAnalyzerComponent', () => {
  let component: YieldAnalyzerComponent;
  let fixture: ComponentFixture<YieldAnalyzerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ YieldAnalyzerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(YieldAnalyzerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
