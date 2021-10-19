import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { SEARCH_CONFIG_SERVICE } from '../../../../../../my-dspace-page/my-dspace-page.component';
import { SearchConfigurationService } from '../../../../../../core/shared/search/search-configuration.service';
import { Item } from '../../../../../../core/shared/item.model';
import { SearchResult } from '../../../../../search/search-result.model';
import { PaginatedList } from '../../../../../../core/data/paginated-list.model';
import { RemoteData } from '../../../../../../core/data/remote-data';
import { Observable } from 'rxjs';
import { RelationshipOptions } from '../../../models/relationship-options.model';
import { PaginationComponentOptions } from '../../../../../pagination/pagination-component-options.model';
import { ListableObject } from '../../../../../object-collection/shared/listable-object.model';
import { SearchService } from '../../../../../../core/shared/search/search.service';
import { ActivatedRoute, Router } from '@angular/router';
import { SelectableListService } from '../../../../../object-list/selectable-list/selectable-list.service';
import { hasValue } from '../../../../../empty.util';
import { map, mapTo, startWith, switchMap, take, tap } from 'rxjs/operators';
import { getFirstSucceededRemoteData, getRemoteDataPayload } from '../../../../../../core/shared/operators';
import { RouteService } from '../../../../../../core/services/route.service';
import { CollectionElementLinkType } from '../../../../../object-collection/collection-element-link.type';
import { Context } from '../../../../../../core/shared/context.model';
import { LookupRelationService } from '../../../../../../core/data/lookup-relation.service';
import { PaginationService } from '../../../../../../core/pagination/pagination.service';
import { RelationshipService } from '../../../../../../core/data/relationship.service';
import { RelationshipType } from '../../../../../../core/shared/item-relationships/relationship-type.model';

import { Relationship } from '../../../../../../core/shared/item-relationships/relationship.model';


@Component({
  selector: 'ds-dynamic-lookup-relation-search-tab',
  styleUrls: ['./dynamic-lookup-relation-search-tab.component.scss'],
  templateUrl: './dynamic-lookup-relation-search-tab.component.html',
  providers: [
    {
      provide: SEARCH_CONFIG_SERVICE,
      useClass: SearchConfigurationService
    }
  ]
})

/**
 * Tab for inside the lookup model that represents the items that can be used as a relationship in this submission
 */
export class DsDynamicLookupRelationSearchTabComponent implements OnInit, OnDestroy {
  /**
   * Options for searching related items
   */
  @Input() relationship: RelationshipOptions;

  /**
   * The ID of the list to add/remove selected items to/from
   */
  @Input() listId: string;
  @Input() query: string;

  /**
   * Is the selection repeatable?
   */
  @Input() repeatable: boolean;

  /**
   * The list of selected items
   */
  @Input() selection$: Observable<ListableObject[]>;

  /**
   * The context to display lists
   */
  @Input() context: Context;

  /**
   * The type of relationship
   */
  @Input() relationshipType: RelationshipType;

  /**
   * The item being viewed
   */
  @Input() item: Item;

  /**
   * Check if is left type or right type
   */
  @Input() isLeft: boolean;

  /**
   * Check if is left type or right type
   */
  @Input() toRemove: SearchResult<Item>[];


  /**
   * Check if is being utilized by edit relationship component
   */
  @Input() isEditRelationship: boolean;

  /**
   * Send an event to deselect an object from the list
   */
  @Output() deselectObject: EventEmitter<ListableObject> = new EventEmitter<ListableObject>();

  /**
   * Send an event to select an object from the list
   */
  @Output() selectObject: EventEmitter<ListableObject> = new EventEmitter<ListableObject>();

  /**
   * Search results
   */
  resultsRD$: Observable<RemoteData<PaginatedList<SearchResult<Item>>>>;

  /**
   * Are all results selected?
   */
  allSelected: boolean;

  /**
   * Are some results selected?
   */
  someSelected$: Observable<boolean>;

  /**
   * Is it currently loading to select all results?
   */
  selectAllLoading: boolean;

  /**
   * Subscription to unsubscribe from
   */
  subscription;

  /**
   * The initial pagination to use
   */
  initialPagination = {
    page: 1,
    pageSize: 5
  };

  /**
   * The type of links to display
   */
  linkTypes = CollectionElementLinkType;

  constructor(
    private searchService: SearchService,
    private router: Router,
    private route: ActivatedRoute,
    private selectableListService: SelectableListService,
    public searchConfigService: SearchConfigurationService,
    private routeService: RouteService,
    public lookupRelationService: LookupRelationService,
    private relationshipService: RelationshipService,
    private paginationService: PaginationService
  ) {
  }

  /**
   * Sets up the pagination and fixed query parameters
   */
  ngOnInit(): void {
    this.resetRoute();
    this.routeService.setParameter('fixedFilterQuery', this.relationship.filter);
    this.routeService.setParameter('configuration', this.relationship.searchConfiguration);
    this.resultsRD$ = this.searchConfigService.paginatedSearchOptions.pipe(
      switchMap((options) => this.lookupRelationService.getLocalResults(this.relationship, options).pipe(
        tap( res => {
          if ( !!res && res.hasSucceeded && this.isEditRelationship ) {
            const idOfItems = res.payload.page.map( itemSearchResult => {
              return itemSearchResult.indexableObject.uuid;
            });
            this.setSelectedIds(idOfItems,res.payload.page);
          }
        }),
        startWith(undefined),
      ))
    );
  }

  /**
   * Method to reset the route when the window is opened to make sure no strange pagination issues appears
   */
  resetRoute() {
    this.paginationService.updateRoute(this.searchConfigService.paginationID, this.initialPagination);
  }

  /**
   * Selects a page in the store
   * @param page The page to select
   */
  selectPage(page: SearchResult<Item>[]) {
    this.selection$
      .pipe(take(1))
      .subscribe((selection: SearchResult<Item>[]) => {
        const filteredPage = page.filter((pageItem) => selection.findIndex((selected) => selected.equals(pageItem)) < 0);
        this.selectObject.emit(...filteredPage);
      });
    this.selectableListService.select(this.listId, page);
  }

  /**
   * Deselects a page in the store
   * @param page the page to deselect
   */
  deselectPage(page: SearchResult<Item>[]) {
    this.allSelected = false;
    this.selection$
      .pipe(take(1))
      .subscribe((selection: SearchResult<Item>[]) => {
        const filteredPage = page.filter((pageItem) => selection.findIndex((selected) => selected.equals(pageItem)) >= 0);
        this.deselectObject.emit(...filteredPage);
      });
    this.selectableListService.deselect(this.listId, page);
  }

  /**
   * Select all items that were found using the current search query
   */
  selectAll() {
    this.allSelected = true;
    this.selectAllLoading = true;
    const fullPagination = Object.assign(new PaginationComponentOptions(), {
      currentPage: 1,
      pageSize: 9999
    });
    const fullSearchConfig = Object.assign(this.lookupRelationService.searchConfig, { pagination: fullPagination });
    const results$ = this.searchService.search<Item>(fullSearchConfig);
    results$.pipe(
      getFirstSucceededRemoteData(),
      map((resultsRD) => resultsRD.payload.page),
      tap(() => this.selectAllLoading = false),
      switchMap((results) => this.selection$.pipe(
        take(1),
        tap((selection: SearchResult<Item>[]) => {
          const filteredResults = results.filter((pageItem) => selection.findIndex((selected) => selected.equals(pageItem)) < 0);
          this.selectObject.emit(...filteredResults);
        }),
        mapTo(results)
      ))
    ).subscribe((results) => {
        this.selectableListService.select(this.listId, results);
    });
  }

  /**
   * setSelectedIds select all the items from the results that have relationship
   * @param idOfItems the uuid of items that are being checked
   * @param resultListOfItems the list of results of the items
   */
  setSelectedIds(idOfItems, resultListOfItems) {
    let relationType = this.relationshipType.rightwardType;
    if ( this.isLeft ) {
      relationType = this.relationshipType.leftwardType;
    }
    this.relationshipService.searchByItemsAndType( this.relationshipType.id, this.item.uuid, relationType ,idOfItems ).pipe(
        getFirstSucceededRemoteData(),
        getRemoteDataPayload(),
      ).subscribe( (res: PaginatedList<Relationship>) => {

        let selectableObject = res.page.map( (relationship: any) => {

          let arrUrl = [];
          if ( this.isLeft ) {
            arrUrl = relationship._links.rightItem.href.split('/');
          } else {
            arrUrl = relationship._links.leftItem.href.split('/');
          }
          const uuid = arrUrl[ arrUrl.length - 1 ];

          return this.getRelatedItem(uuid,resultListOfItems);
        });

        selectableObject = selectableObject.filter((selObject)=>{
          return !this.getIfInRemove(selObject.indexableObject.uuid);
        })

        if ( selectableObject.length > 0 ) {
          this.selectableListService.select(this.listId, selectableObject);
        }
    });
  }

  /**
   * Deselect all items
   */
  deselectAll() {
    this.allSelected = false;
    this.selection$
      .pipe(take(1))
      .subscribe((selection: SearchResult<Item>[]) => this.deselectObject.emit(...selection));
    this.selectableListService.deselectAll(this.listId);
  }

  getRelatedItem(uuid: string, resultList: SearchResult<Item>[]) {
    return resultList.find( (resultItem) => {
      return resultItem.indexableObject.uuid === uuid;
    });
  }

  getIfInRemove(uuid: string) {
    return !!this.toRemove.find((searchResult)=> searchResult.indexableObject.uuid == uuid);
  }

  ngOnDestroy(): void {
    if (hasValue(this.subscription)) {
      this.subscription.unsubscribe();
    }
  }
}
